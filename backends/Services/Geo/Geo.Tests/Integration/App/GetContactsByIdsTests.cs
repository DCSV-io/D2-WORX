// -----------------------------------------------------------------------
// <copyright file="GetContactsByIdsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Contracts.Interfaces.Caching.InMemory.Handlers.R;
using D2.Contracts.Interfaces.Caching.InMemory.Handlers.U;
using D2.Contracts.Result;
using D2.Geo.App;
using D2.Geo.App.Implementations.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;
using GetContactsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetContactsByIds;

/// <summary>
/// Integration tests for the <see cref="GetContactsByIds"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class GetContactsByIdsTests : IAsyncLifetime
{
    private PostgreSqlContainer _pgContainer = null!;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _infraOptions = null!;
    private IOptions<GeoAppOptions> _appOptions = null!;
    private Mock<IRead.IGetManyHandler<Contact>> _mockCacheGetMany = null!;
    private Mock<IUpdate.ISetManyHandler<Contact>> _mockCacheSetMany = null!;

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
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .Options;
        _db = new GeoDbContext(dbOptions);
        await _db.Database.MigrateAsync(Ct);

        _context = CreateHandlerContext();
        _infraOptions = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
        _appOptions = Options.Create(new GeoAppOptions { ContactExpirationDuration = TimeSpan.FromHours(1) });

        SetupMockCacheHandlers();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _pgContainer.DisposeAsync().ConfigureAwait(false);
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
        // Arrange - Create a contact
        var contact = CreateTestContact("single-ctx", "Single", "Contact");
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
        // Arrange - Create multiple contacts
        var contact1 = CreateTestContact("ctx-1", "User", "One");
        var contact2 = CreateTestContact("ctx-2", "User", "Two");
        var contact3 = CreateTestContact("ctx-3", "User", "Three");
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
        // Arrange - Create one contact
        var contact = CreateTestContact("partial-ctx", "Partial", "Found");
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
        // Arrange - Setup cache to return contacts
        var cachedContact = CreateTestContact("cached-ctx", "Cached", "Contact");
        var cacheKey = $"GetContactsByIds:{cachedContact.Id}";

        _mockCacheGetMany
            .Setup(x => x.HandleAsync(It.IsAny<IRead.GetManyInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync((IRead.GetManyInput input, CancellationToken _, HandlerOptions? _) =>
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
        // Arrange - Create a contact in database (cache miss)
        var contact = CreateTestContact("cache-miss-ctx", "Cache", "Miss");
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
    /// Tests that GetContactsByIds filters out invalid GUID strings.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithInvalidGuids_FiltersInvalidIds()
    {
        // Arrange - Create a contact
        var contact = CreateTestContact("valid-ctx", "Valid", "Contact");
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

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);
        result.Data.Data.Should().ContainKey(contact.Id);
    }

    /// <summary>
    /// Tests that GetContactsByIds with only invalid GUIDs returns empty.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByIds_WithOnlyInvalidGuids_ReturnsEmpty()
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

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
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
        // Arrange - Create contacts in database
        var contactInDb = CreateTestContact("db-ctx", "Database", "Contact");
        _db.Contacts.Add(contactInDb);
        await _db.SaveChangesAsync(Ct);

        // Setup cache to return one contact (simulating partial hit)
        var cachedContact = CreateTestContact("cached-ctx", "Cached", "Contact");
        var cacheKey = $"GetContactsByIds:{cachedContact.Id}";

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
        return new GetContactsByIds(
            _mockCacheGetMany.Object,
            _mockCacheSetMany.Object,
            getContactsRepo,
            _appOptions,
            _context);
    }
}
