// -----------------------------------------------------------------------
// <copyright file="CreateContactsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;
using CreateContactsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateContacts;
using CreateLocationsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateLocations;

/// <summary>
/// Integration tests for the <see cref="CreateContacts"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class CreateContactsTests : IAsyncLifetime
{
    private PostgreSqlContainer _pgContainer = null!;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _pgContainer = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();
        await _pgContainer.StartAsync(Ct);

        var dbOptions = new DbContextOptionsBuilder<GeoDbContext>()
            .UseNpgsql(_pgContainer.GetConnectionString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        _db = new GeoDbContext(dbOptions);
        await _db.Database.MigrateAsync(Ct);

        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _pgContainer.DisposeAsync().ConfigureAwait(false);
    }

    #region Empty Input Tests

    /// <summary>
    /// Tests that CreateContacts with empty input returns success with empty list.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithEmptyInput_ReturnsEmptyList()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest();
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Contact Without Location Tests

    /// <summary>
    /// Tests that CreateContacts creates contacts without locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithoutLocation_CreatesContacts()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "test-context",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO
                    {
                        FirstName = "John",
                        LastName = "Doe",
                    },
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data[0].ContextKey.Should().Be("test-context");
        result.Data.Data[0].PersonalDetails!.FirstName.Should().Be("John");
        result.Data.Data[0].LocationHashId.Should().BeEmpty();

        // Verify in database
        var dbContacts = await _db.Contacts.ToListAsync(Ct);
        dbContacts.Should().HaveCount(1);
        dbContacts[0].LocationHashId.Should().BeNull();
    }

    #endregion

    #region Contact With Embedded Location Tests

    /// <summary>
    /// Tests that CreateContacts creates contacts with embedded locations.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithEmbeddedLocation_CreatesLocationAndContact()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "test-context",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO
                    {
                        FirstName = "Jane",
                        LastName = "Smith",
                    },
                    LocationToCreate = new LocationToCreateDTO
                    {
                        City = "New York",
                        PostalCode = "10001",
                        CountryIso31661Alpha2Code = "US",
                    },
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data[0].LocationHashId.Should().NotBeNullOrEmpty();
        result.Data.Data[0].LocationHashId.Should().HaveLength(64);

        // Verify location was created in database
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
        dbLocations[0].City.Should().Be("New York");
        dbLocations[0].PostalCode.Should().Be("10001");
        dbLocations[0].CountryISO31661Alpha2Code.Should().Be("US");

        // Verify contact references the location
        var dbContacts = await _db.Contacts.ToListAsync(Ct);
        dbContacts[0].LocationHashId.Should().Be(dbLocations[0].HashId);
    }

    /// <summary>
    /// Tests that CreateContacts deduplicates locations for multiple contacts.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithSameLocation_DeduplicatesLocations()
    {
        // Arrange
        var handler = CreateHandler();
        var sameLocation = new LocationToCreateDTO
        {
            City = "Los Angeles",
            CountryIso31661Alpha2Code = "US",
        };

        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "contact-1",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "User", LastName = "One" },
                    LocationToCreate = sameLocation,
                },
                new ContactToCreateDTO
                {
                    ContextKey = "contact-2",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "User", LastName = "Two" },
                    LocationToCreate = sameLocation,
                },
                new ContactToCreateDTO
                {
                    ContextKey = "contact-3",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "User", LastName = "Three" },
                    LocationToCreate = sameLocation,
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);

        // All contacts should reference the same location
        var locationHashIds = result.Data.Data.Select(c => c.LocationHashId).Distinct().ToList();
        locationHashIds.Should().HaveCount(1);

        // Only one location should be created
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
    }

    #endregion

    #region Contact With Explicit Location Hash Tests

    /// <summary>
    /// Tests that CreateContacts uses explicit location_hash_id when provided.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithExplicitLocationHashId_UsesExplicitHash()
    {
        // Arrange - Create a location first
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: "Chicago",
            postalCode: "60601",
            subdivisionISO31662Code: "US-IL",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "test-context",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Test", LastName = "User" },
                    LocationHashId = location.HashId, // Explicit reference
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data[0].LocationHashId.Should().Be(location.HashId);

        // No new locations should be created
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
    }

    /// <summary>
    /// Tests that explicit location_hash_id takes precedence over location_to_create.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithBothHashAndLocation_UsesExplicitHash()
    {
        // Arrange - Create a location first
        var existingLocation = Location.Create(
            coordinates: null,
            address: null,
            city: "Miami",
            postalCode: "33101",
            subdivisionISO31662Code: "US-FL",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(existingLocation);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "test-context",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Test", LastName = "User" },
                    LocationHashId = existingLocation.HashId, // Explicit reference
                    LocationToCreate = new LocationToCreateDTO
                    {
                        City = "Different City", // This should be ignored
                        CountryIso31661Alpha2Code = "CA",
                    },
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data[0].LocationHashId.Should().Be(existingLocation.HashId);

        // No new location should be created for "Different City"
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(1);
        dbLocations[0].City.Should().Be("Miami");
    }

    #endregion

    #region Mixed Scenario Tests

    /// <summary>
    /// Tests creating contacts with mixed location scenarios.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task CreateContacts_WithMixedScenarios_HandlesAllCorrectly()
    {
        // Arrange - Create an existing location
        var existingLocation = Location.Create(
            coordinates: null,
            address: null,
            city: "Seattle",
            postalCode: "98101",
            subdivisionISO31662Code: "US-WA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(existingLocation);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                // Contact 1: No location
                new ContactToCreateDTO
                {
                    ContextKey = "no-location",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "No", LastName = "Location" },
                },

                // Contact 2: Explicit location hash
                new ContactToCreateDTO
                {
                    ContextKey = "explicit-hash",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Explicit", LastName = "Hash" },
                    LocationHashId = existingLocation.HashId,
                },

                // Contact 3: New embedded location
                new ContactToCreateDTO
                {
                    ContextKey = "new-location",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "Location" },
                    LocationToCreate = new LocationToCreateDTO
                    {
                        City = "Boston",
                        CountryIso31661Alpha2Code = "US",
                    },
                },

                // Contact 4: Same embedded location as Contact 3 (should deduplicate)
                new ContactToCreateDTO
                {
                    ContextKey = "same-as-3",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Same", LastName = "Location" },
                    LocationToCreate = new LocationToCreateDTO
                    {
                        City = "Boston",
                        CountryIso31661Alpha2Code = "US",
                    },
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(4);

        // Contact 1: No location
        result.Data.Data[0].LocationHashId.Should().BeEmpty();

        // Contact 2: Uses existing location
        result.Data.Data[1].LocationHashId.Should().Be(existingLocation.HashId);

        // Contacts 3 & 4: Both use the same new location
        result.Data.Data[2].LocationHashId.Should().NotBeNullOrEmpty();
        result.Data.Data[3].LocationHashId.Should().Be(result.Data.Data[2].LocationHashId);

        // Verify: 2 locations total (Seattle + Boston)
        var dbLocations = await _db.Locations.ToListAsync(Ct);
        dbLocations.Should().HaveCount(2);

        // Verify: 4 contacts
        var dbContacts = await _db.Contacts.ToListAsync(Ct);
        dbContacts.Should().HaveCount(4);
    }

    #endregion

    private static IHandlerContext CreateHandlerContext()
    {
        var requestContext = new Mock<IRequestContext>();
        requestContext.Setup(x => x.TraceId).Returns(Guid.NewGuid().ToString());

        var logger = new Mock<ILogger>();

        var context = new Mock<IHandlerContext>();
        context.Setup(x => x.Request).Returns(requestContext.Object);
        context.Setup(x => x.Logger).Returns(logger.Object);

        return context.Object;
    }

    private ICommands.ICreateContactsHandler CreateHandler()
    {
        var createContactsRepo = new CreateContactsRepo(_db, _context);
        var createLocationsRepo = new CreateLocationsRepo(_db, _options, _context);
        return new CreateContacts(createContactsRepo, createLocationsRepo, _context);
    }
}
