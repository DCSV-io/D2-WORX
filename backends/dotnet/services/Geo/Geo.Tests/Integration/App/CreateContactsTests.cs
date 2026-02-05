// -----------------------------------------------------------------------
// <copyright file="CreateContactsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Geo.App;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Implementations.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.R;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.U;
using D2.Shared.Result;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using CreateContactsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateContacts;
using CreateLocationsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateLocations;
using GetLocationsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetLocationsByIds;

/// <summary>
/// Integration tests for the <see cref="CreateContacts"/> CQRS handler.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class CreateContactsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateContactsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public CreateContactsTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();
        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync().ConfigureAwait(false);
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
        var uniqueContext = $"test-context-{Guid.NewGuid():N}";
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = uniqueContext,
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
        result.Data.Data[0].ContextKey.Should().Be(uniqueContext);
        result.Data.Data[0].PersonalDetails!.FirstName.Should().Be("John");
        result.Data.Data[0].Location.Should().BeNull();
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
        var uniqueCity = $"New York {Guid.NewGuid():N}";
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = $"test-context-{Guid.NewGuid():N}",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO
                    {
                        FirstName = "Jane",
                        LastName = "Smith",
                    },
                    Location = new LocationDTO
                    {
                        City = uniqueCity,
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

        // Verify the location is included in the response
        result.Data.Data[0].Location.Should().NotBeNull();
        result.Data.Data[0].Location!.City.Should().Be(uniqueCity);
        result.Data.Data[0].Location.PostalCode.Should().Be("10001");
        result.Data.Data[0].Location.CountryIso31661Alpha2Code.Should().Be("US");

        // Verify the contact was created with a location by checking the domain entity
        var domainContact = await _db.Contacts.FirstAsync(c => c.ContextKey == request.ContactsToCreate[0].ContextKey, Ct);
        domainContact.LocationHashId.Should().NotBeNullOrEmpty();
        domainContact.LocationHashId.Should().HaveLength(64);

        // Verify location was created in database
        var dbLocation = await _db.Locations.FirstOrDefaultAsync(l => l.City == uniqueCity, Ct);
        dbLocation.Should().NotBeNull();
        dbLocation.PostalCode.Should().Be("10001");
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
        var uniqueCity = $"Los Angeles {Guid.NewGuid():N}";
        var sameLocation = new LocationDTO
        {
            City = uniqueCity,
            CountryIso31661Alpha2Code = "US",
        };

        var contextKey1 = $"contact-1-{Guid.NewGuid():N}";
        var contextKey2 = $"contact-2-{Guid.NewGuid():N}";
        var contextKey3 = $"contact-3-{Guid.NewGuid():N}";
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = contextKey1,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "User", LastName = "One" },
                    Location = sameLocation,
                },
                new ContactToCreateDTO
                {
                    ContextKey = contextKey2,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "User", LastName = "Two" },
                    Location = sameLocation,
                },
                new ContactToCreateDTO
                {
                    ContextKey = contextKey3,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "User", LastName = "Three" },
                    Location = sameLocation,
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);

        // Verify all contacts reference the same location by checking domain entities
        var contacts = await _db.Contacts
            .Where(c => c.ContextKey == contextKey1 || c.ContextKey == contextKey2 || c.ContextKey == contextKey3)
            .ToListAsync(Ct);
        var locationHashIds = contacts.Select(c => c.LocationHashId).Distinct().ToList();
        locationHashIds.Should().HaveCount(1);
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
        var uniqueCity = $"Chicago {Guid.NewGuid():N}";
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: uniqueCity,
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
                    ContextKey = $"test-context-{Guid.NewGuid():N}",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Test", LastName = "User" },
                    Location = new LocationDTO { HashId = location.HashId }, // Explicit reference
                },
            },
        };
        var input = new ICommands.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        // Verify the contact was created with the correct location
        var domainContact = await _db.Contacts.FirstAsync(c => c.ContextKey == request.ContactsToCreate[0].ContextKey, Ct);
        domainContact.LocationHashId.Should().Be(location.HashId);
    }

    // Note: With the new proto structure, there's no separate location_hash_id vs location_to_create.
    // The Location field can contain either just a HashId (reference) or full location data (create new).
    // Full location data takes precedence when computing the hash.
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
        var existingCity = $"Seattle {Guid.NewGuid():N}";
        var existingLocation = Location.Create(
            coordinates: null,
            address: null,
            city: existingCity,
            postalCode: "98101",
            subdivisionISO31662Code: "US-WA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(existingLocation);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var newCity = $"Boston {Guid.NewGuid():N}";
        var contextKey1 = $"no-location-{Guid.NewGuid():N}";
        var contextKey2 = $"explicit-hash-{Guid.NewGuid():N}";
        var contextKey3 = $"new-location-{Guid.NewGuid():N}";
        var contextKey4 = $"same-as-3-{Guid.NewGuid():N}";
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                // Contact 1: No location
                new ContactToCreateDTO
                {
                    ContextKey = contextKey1,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "No", LastName = "Location" },
                },

                // Contact 2: Explicit location hash reference
                new ContactToCreateDTO
                {
                    ContextKey = contextKey2,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Explicit", LastName = "Hash" },
                    Location = new LocationDTO { HashId = existingLocation.HashId },
                },

                // Contact 3: New embedded location
                new ContactToCreateDTO
                {
                    ContextKey = contextKey3,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "Location" },
                    Location = new LocationDTO
                    {
                        City = newCity,
                        CountryIso31661Alpha2Code = "US",
                    },
                },

                // Contact 4: Same embedded location as Contact 3 (should deduplicate)
                new ContactToCreateDTO
                {
                    ContextKey = contextKey4,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Same", LastName = "Location" },
                    Location = new LocationDTO
                    {
                        City = newCity,
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

        // Verify locations by checking domain entities
        var contact1 = await _db.Contacts.FirstAsync(c => c.ContextKey == contextKey1, Ct);
        var contact2 = await _db.Contacts.FirstAsync(c => c.ContextKey == contextKey2, Ct);
        var contact3 = await _db.Contacts.FirstAsync(c => c.ContextKey == contextKey3, Ct);
        var contact4 = await _db.Contacts.FirstAsync(c => c.ContextKey == contextKey4, Ct);

        // Contact 1: No location
        contact1.LocationHashId.Should().BeNull();

        // Contact 2: Uses existing location
        contact2.LocationHashId.Should().Be(existingLocation.HashId);

        // Contacts 3 & 4: Both use the same new location
        contact3.LocationHashId.Should().NotBeNullOrEmpty();
        contact4.LocationHashId.Should().Be(contact3.LocationHashId);
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
        var getLocationsByIds = CreateGetLocationsByIdsHandler();
        return new CreateContacts(createContactsRepo, createLocationsRepo, getLocationsByIds, _context);
    }

    private IQueries.IGetLocationsByIdsHandler CreateGetLocationsByIdsHandler()
    {
        // Mock cache handlers that always return NOT_FOUND (forcing repo lookup).
        var mockCacheGetMany = new Mock<IRead.IGetManyHandler<Location>>();
        mockCacheGetMany
            .Setup(x => x.HandleAsync(It.IsAny<IRead.GetManyInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IRead.GetManyOutput<Location>?>.NotFound());

        var mockCacheSetMany = new Mock<IUpdate.ISetManyHandler<Location>>();
        mockCacheSetMany
            .Setup(x => x.HandleAsync(It.IsAny<IUpdate.SetManyInput<Location>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IUpdate.SetManyOutput?>.Ok(new IUpdate.SetManyOutput()));

        var getLocationsRepo = new GetLocationsByIdsRepo(_db, _options, _context);
        var appOptions = Options.Create(new GeoAppOptions());

        return new GetLocationsByIds(
            mockCacheGetMany.Object,
            mockCacheSetMany.Object,
            getLocationsRepo,
            appOptions,
            _context);
    }
}
