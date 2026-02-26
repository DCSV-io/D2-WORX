// -----------------------------------------------------------------------
// <copyright file="GetContactsByIdsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Geo.App;
using D2.Geo.App.Implementations.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
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
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using ClientCacheKeys = D2.Geo.Client.CacheKeys;
using GetContactsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetContactsByIds;
using GetLocationsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetLocationsByIds;

/// <summary>
/// Integration tests for the <see cref="GetContactsByIds"/> CQRS handler.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class GetContactsByIdsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _infraOptions = null!;
    private IOptions<GeoAppOptions> _appOptions = null!;
    private Mock<IRead.IGetManyHandler<Contact>> _mockCacheGetMany = null!;
    private Mock<IUpdate.ISetManyHandler<Contact>> _mockCacheSetMany = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetContactsByIdsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public GetContactsByIdsTests(SharedPostgresFixture fixture)
    {
        r_fixture = fixture;
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public ValueTask InitializeAsync()
    {
        _db = r_fixture.CreateDbContext();
        _context = CreateHandlerContext();
        _infraOptions = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
        _appOptions = Options.Create(new GeoAppOptions { ContactExpirationDuration = TimeSpan.FromHours(1) });

        SetupMockCacheHandlers();
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    #region Empty Input Tests

    /// <summary>
    /// Tests that GetContactsByIds with empty input returns success with empty dictionary.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsRequest();
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Get Single Contact Tests

    /// <summary>
    /// Tests that GetContactsByIds retrieves a single contact by ID.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithSingleId_ReturnsContact()
    {
        // Arrange - Create a contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"single-ctx-{suffix}", "Single", "Contact");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest { Ids = { contact.Id.ToString() } };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data.Should().ContainKey(contact.Id);
        result.Data.Data[contact.Id].PersonalDetails!.FirstName.Should().Be("Single");
        result.Data.Data[contact.Id].PersonalDetails!.LastName.Should().Be("Contact");

        // Location should be null when Contact has no LocationHashId
        result.Data.Data[contact.Id].Location.Should().BeNull();
    }

    /// <summary>
    /// Tests that GetContactsByIds returns nested Location data when Contact has a location.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithLocation_ReturnsNestedLocationData()
    {
        // Arrange - Create a location first
        var suffix = Guid.NewGuid().ToString("N");
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: $"Contact City {suffix}",
            postalCode: "90210",
            subdivisionISO31662Code: "US-CA",
            countryISO31661Alpha2Code: "US");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        // Create contact with reference to the location
        var contact = Contact.Create(
            contextKey: $"loc-ctx-{suffix}",
            relatedEntityId: Guid.NewGuid(),
            personalDetails: Personal.Create("Located", lastName: "Contact"),
            locationHashId: location.HashId);
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest { Ids = { contact.Id.ToString() } };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var dto = result.Data.Data[contact.Id];

        // Verify Contact fields
        dto.PersonalDetails!.FirstName.Should().Be("Located");
        dto.PersonalDetails.LastName.Should().Be("Contact");

        // Verify nested Location is present and correct
        dto.Location.Should().NotBeNull();
        dto.Location!.HashId.Should().Be(location.HashId);
        dto.Location.City.Should().Be($"Contact City {suffix}");
        dto.Location.PostalCode.Should().Be("90210");
        dto.Location.SubdivisionIso31662Code.Should().Be("US-CA");
        dto.Location.CountryIso31661Alpha2Code.Should().Be("US");
    }

    /// <summary>
    /// Tests that GetContactsByIds handles mixed records - some with locations, some without.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithMixedLocationScenarios_HandlesGracefully()
    {
        // Arrange - Create a location
        var suffix = Guid.NewGuid().ToString("N");
        var location = Location.Create(
            coordinates: null,
            address: null,
            city: $"Mixed Contact City {suffix}",
            postalCode: "H0H0H0",
            subdivisionISO31662Code: "CA-QC",
            countryISO31661Alpha2Code: "CA");
        _db.Locations.Add(location);
        await _db.SaveChangesAsync(Ct);

        // Create Contact WITH location
        var contactWithLocation = Contact.Create(
            contextKey: $"with-loc-ctx-{suffix}",
            relatedEntityId: Guid.NewGuid(),
            personalDetails: Personal.Create("With", lastName: "Location"),
            locationHashId: location.HashId);

        // Create Contact WITHOUT location
        var contactWithoutLocation = Contact.Create(
            contextKey: $"no-loc-ctx-{suffix}",
            relatedEntityId: Guid.NewGuid(),
            personalDetails: Personal.Create("Without", lastName: "Location"));

        _db.Contacts.AddRange(contactWithLocation, contactWithoutLocation);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { contactWithLocation.Id.ToString(), contactWithoutLocation.Id.ToString() },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(2);

        // Contact with location should have nested Location data
        var dtoWithLocation = result.Data.Data[contactWithLocation.Id];
        dtoWithLocation.Location.Should().NotBeNull();
        dtoWithLocation.Location!.City.Should().Be($"Mixed Contact City {suffix}");
        dtoWithLocation.Location.CountryIso31661Alpha2Code.Should().Be("CA");

        // Contact without location should have null Location
        var dtoWithoutLocation = result.Data.Data[contactWithoutLocation.Id];
        dtoWithoutLocation.Location.Should().BeNull();
    }

    #endregion

    #region Get Multiple Contacts Tests

    /// <summary>
    /// Tests that GetContactsByIds retrieves multiple contacts by IDs.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithMultipleIds_ReturnsAllContacts()
    {
        // Arrange - Create multiple contacts with unique context keys
        var suffix = Guid.NewGuid().ToString("N");
        var contact1 = CreateTestContact($"ctx-1-{suffix}", "User", "One");
        var contact2 = CreateTestContact($"ctx-2-{suffix}", "User", "Two");
        var contact3 = CreateTestContact($"ctx-3-{suffix}", "User", "Three");
        _db.Contacts.AddRange(contact1, contact2, contact3);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { contact1.Id.ToString(), contact2.Id.ToString(), contact3.Id.ToString() },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(3);
        result.Data.Data.Should().ContainKey(contact1.Id);
        result.Data.Data.Should().ContainKey(contact2.Id);
        result.Data.Data.Should().ContainKey(contact3.Id);
    }

    #endregion

    #region Not Found Tests

    /// <summary>
    /// Tests that GetContactsByIds returns NOT_FOUND when no contacts exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithNonExistentIds_ReturnsNotFound()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { Guid.NewGuid().ToString(), Guid.NewGuid().ToString() },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
    }

    #endregion

    #region Partial Found Tests

    /// <summary>
    /// Tests that GetContactsByIds returns SOME_FOUND when only some contacts exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithMixedIds_ReturnsSomeFound()
    {
        // Arrange - Create one contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"partial-ctx-{suffix}", "Partial", "Found");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { contact.Id.ToString(), Guid.NewGuid().ToString(), Guid.NewGuid().ToString() },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data.Should().ContainKey(contact.Id);
    }

    #endregion

    #region Cache Hit Tests

    /// <summary>
    /// Tests that GetContactsByIds returns cached contacts without hitting repository.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WhenAllInCache_SkipsRepository()
    {
        // Arrange - Setup cache to return contacts with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var cachedContact = CreateTestContact($"cached-ctx-{suffix}", "Cached", "Contact");
        var cacheKey = ClientCacheKeys.Contact(cachedContact.Id);

        _mockCacheGetMany
            .Setup(x => x.HandleAsync(It.IsAny<IRead.GetManyInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync((IRead.GetManyInput _, CancellationToken _, HandlerOptions? _) =>
            {
                var values = new Dictionary<string, Contact> { { cacheKey, cachedContact } };
                return D2Result<IRead.GetManyOutput<Contact>?>.Ok(new IRead.GetManyOutput<Contact>(values));
            });

        var handler = CreateHandler();
        var request = new GetContactsRequest { Ids = { cachedContact.Id.ToString() } };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data.Should().ContainKey(cachedContact.Id);
        result.Data.Data[cachedContact.Id].PersonalDetails!.FirstName.Should().Be("Cached");

        // Verify cache set was NOT called (all from cache)
        _mockCacheSetMany.Verify(
            x => x.HandleAsync(It.IsAny<IUpdate.SetManyInput<Contact>>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that GetContactsByIds populates cache with fetched contacts.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WhenCacheMiss_PopulatesCache()
    {
        // Arrange - Create a contact in database (cache miss) with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"cache-miss-ctx-{suffix}", "Cache", "Miss");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest { Ids = { contact.Id.ToString() } };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        // Verify cache set was called
        _mockCacheSetMany.Verify(
            x => x.HandleAsync(
                It.Is<IUpdate.SetManyInput<Contact>>(i => i.Values.Count == 1),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Invalid ID Tests

    /// <summary>
    /// Tests that GetContactsByIds returns ValidationFailed when any GUIDs are invalid.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithInvalidGuids_ReturnsValidationFailed()
    {
        // Arrange - Create a contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"valid-ctx-{suffix}", "Valid", "Contact");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { contact.Id.ToString(), "not-a-guid", "also-invalid", string.Empty },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — should return ValidationFailed (not silent filter)
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();

        // Should have indexed error paths for each invalid ID.
        result.InputErrors.Should().Contain(e => e[0] == "ids[1]");
        result.InputErrors.Should().Contain(e => e[0] == "ids[2]");
        result.InputErrors.Should().Contain(e => e[0] == "ids[3]");
    }

    /// <summary>
    /// Tests that GetContactsByIds with only invalid GUIDs returns ValidationFailed.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithOnlyInvalidGuids_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { "not-a-guid", "also-invalid", string.Empty },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — should return ValidationFailed (not empty OK)
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(3);
    }

    /// <summary>
    /// Tests that GetContactsByIds with Guid.Empty returns ValidationFailed.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithEmptyGuid_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { Guid.Empty.ToString() },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0] == "ids[0]");
    }

    #endregion

    #region Mixed Cache Tests

    /// <summary>
    /// Tests that GetContactsByIds handles partial cache hits correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithPartialCacheHit_FetchesMissingFromRepo()
    {
        // Arrange - Create contacts in database with unique context keys
        var suffix = Guid.NewGuid().ToString("N");
        var contactInDb = CreateTestContact($"db-ctx-{suffix}", "Database", "Contact");
        _db.Contacts.Add(contactInDb);
        await _db.SaveChangesAsync(Ct);

        // Setup cache to return one contact (simulating partial hit)
        var cachedContact = CreateTestContact($"cached-ctx-{suffix}", "Cached", "Contact");
        var cacheKey = ClientCacheKeys.Contact(cachedContact.Id);

        _mockCacheGetMany
            .Setup(x => x.HandleAsync(It.IsAny<IRead.GetManyInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync((IRead.GetManyInput input, CancellationToken _, HandlerOptions? _) =>
            {
                // Only return the cached contact if its key was requested
                if (input.Keys.Any(k => k == cacheKey))
                {
                    var values = new Dictionary<string, Contact> { { cacheKey, cachedContact } };
                    return D2Result<IRead.GetManyOutput<Contact>?>.SomeFound(new IRead.GetManyOutput<Contact>(values));
                }

                return D2Result<IRead.GetManyOutput<Contact>?>.NotFound();
            });

        var handler = CreateHandler();
        var request = new GetContactsRequest
        {
            Ids = { cachedContact.Id.ToString(), contactInDb.Id.ToString() },
        };
        var input = new IQueries.GetContactsByIdsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(2);
        result.Data.Data.Should().ContainKey(cachedContact.Id);
        result.Data.Data.Should().ContainKey(contactInDb.Id);
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

    private static Contact CreateTestContact(string contextKey, string firstName, string lastName)
    {
        return Contact.Create(
            contextKey: contextKey,
            relatedEntityId: Guid.NewGuid(),
            personalDetails: Personal.Create(firstName, lastName: lastName));
    }

    private void SetupMockCacheHandlers()
    {
        _mockCacheGetMany = new Mock<IRead.IGetManyHandler<Contact>>();
        _mockCacheSetMany = new Mock<IUpdate.ISetManyHandler<Contact>>();

        // Default: cache miss (NOT_FOUND)
        _mockCacheGetMany
            .Setup(x => x.HandleAsync(It.IsAny<IRead.GetManyInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetManyOutput<Contact>?>.NotFound());

        _mockCacheSetMany
            .Setup(x => x.HandleAsync(It.IsAny<IUpdate.SetManyInput<Contact>>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IUpdate.SetManyOutput?>.Ok(new IUpdate.SetManyOutput()));
    }

    private IQueries.IGetContactsByIdsHandler CreateHandler()
    {
        var getContactsRepo = new GetContactsByIdsRepo(_db, _infraOptions, _context);
        var getLocationsByIds = CreateGetLocationsByIdsHandler();
        return new GetContactsByIds(
            _mockCacheGetMany.Object,
            _mockCacheSetMany.Object,
            getContactsRepo,
            getLocationsByIds,
            _appOptions,
            _context);
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

        var getLocationsRepo = new GetLocationsByIdsRepo(_db, _infraOptions, _context);

        return new GetLocationsByIds(
            mockCacheGetMany.Object,
            mockCacheSetMany.Object,
            getLocationsRepo,
            _appOptions,
            _context);
    }
}
