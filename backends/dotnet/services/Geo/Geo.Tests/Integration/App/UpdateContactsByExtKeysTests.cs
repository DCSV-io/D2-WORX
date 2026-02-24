// -----------------------------------------------------------------------
// <copyright file="UpdateContactsByExtKeysTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Events.Protos.V1;
using D2.Geo.App;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Implementations.CQRS.Handlers.Q;
using D2.Geo.App.Implementations.CQRS.Handlers.X;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.CQRS.Handlers.X;
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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using CreateContactsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateContacts;
using CreateLocationsRepo = D2.Geo.Infra.Repository.Handlers.C.CreateLocations;
using DeleteContactsRepo = D2.Geo.Infra.Repository.Handlers.D.DeleteContacts;
using GetContactsByExtKeysRepo = D2.Geo.Infra.Repository.Handlers.R.GetContactsByExtKeys;
using GetLocationsByIdsRepo = D2.Geo.Infra.Repository.Handlers.R.GetLocationsByIds;
using IPubs = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs;

/// <summary>
/// Integration tests for the <see cref="UpdateContactsByExtKeys"/> complex handler.
/// Uses a real PostgreSQL database to verify the full read→delete→create→map flow.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class UpdateContactsByExtKeysTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;
    private Mock<IPubs.IContactEvictionHandler> _mockEviction = null!;
    private IPubs.ContactEvictionInput? _capturedEvictionInput;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateContactsByExtKeysTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public UpdateContactsByExtKeysTests(SharedPostgresFixture fixture)
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

        _capturedEvictionInput = null;
        _mockEviction = new Mock<IPubs.IContactEvictionHandler>();
        _mockEviction
            .Setup(x => x.HandleAsync(It.IsAny<IPubs.ContactEvictionInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .Callback<IPubs.ContactEvictionInput, CancellationToken, HandlerOptions?>((input, _, _) => _capturedEvictionInput = input)
            .ReturnsAsync(D2Result<IPubs.ContactEvictionOutput?>.Ok(new IPubs.ContactEvictionOutput()));

        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    #region Empty Input

    /// <summary>
    /// Tests that empty input returns success with empty replacements.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ReturnsEmptyResult()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest();
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Replacements.Should().BeEmpty();
    }

    #endregion

    #region Replace Single Contact

    /// <summary>
    /// Tests the full replacement flow: old contact deleted, new contact created, replacement mapping returned.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SingleContact_ReplacesOldWithNew()
    {
        // Arrange — seed an existing contact
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"update-single-{suffix}";
        var relatedEntityId = Guid.NewGuid();
        var oldContact = CreateTestContact(contextKey, relatedEntityId, "Old", "Name");
        _db.Contacts.Add(oldContact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "Name" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — handler succeeded
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");

        // Assert — one replacement mapping
        result.Data!.Replacements.Should().HaveCount(1);
        var replacement = result.Data.Replacements[0];
        replacement.ContextKey.Should().Be(contextKey);
        replacement.RelatedEntityId.Should().Be(relatedEntityId);
        replacement.OldContactId.Should().Be(oldContact.Id);

        // Assert — replacement's NewContact has different ID and contains the NEW data (not old)
        var newContact = replacement.NewContact;
        newContact.Id.Should().NotBe(oldContact.Id.ToString(), "replacement must have a new PK (immutability)");
        newContact.PersonalDetails!.FirstName.Should().Be("New", "must contain the NEW contact's first name");
        newContact.PersonalDetails.LastName.Should().Be("Name");
        newContact.ContextKey.Should().Be(contextKey);
        newContact.RelatedEntityId.Should().Be(relatedEntityId.ToString());

        // Assert — old contact deleted from database
        var dbOld = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == oldContact.Id, Ct);
        dbOld.Should().BeNull("old contact should be deleted");

        // Assert — new contact exists in database with correct data
        var newId = Guid.Parse(newContact.Id);
        var dbNew = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == newId, Ct);
        dbNew.Should().NotBeNull("new contact should exist in database");
        dbNew!.ContextKey.Should().Be(contextKey);
        dbNew.RelatedEntityId.Should().Be(relatedEntityId);
        dbNew.PersonalDetails!.FirstName.Should().Be("New", "DB record must have the new first name");
    }

    #endregion

    #region Replace Multiple Contacts

    /// <summary>
    /// Tests replacing contacts at multiple ext-keys in one call.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleExtKeys_ReplacesAllContacts()
    {
        // Arrange — seed two existing contacts with different ext-keys
        var suffix = Guid.NewGuid().ToString("N");
        var ctx1 = $"update-multi-1-{suffix}";
        var ctx2 = $"update-multi-2-{suffix}";
        var rel1 = Guid.NewGuid();
        var rel2 = Guid.NewGuid();
        var old1 = CreateTestContact(ctx1, rel1, "Old", "One");
        var old2 = CreateTestContact(ctx2, rel2, "Old", "Two");
        _db.Contacts.AddRange(old1, old2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = ctx1,
                    RelatedEntityId = rel1.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "One" },
                },
                new ContactToCreateDTO
                {
                    ContextKey = ctx2,
                    RelatedEntityId = rel2.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "Two" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — handler succeeded
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");

        // Assert — two replacement mappings with correct data
        result.Data!.Replacements.Should().HaveCount(2);

        var rep1 = result.Data.Replacements.Single(r => r.OldContactId == old1.Id);
        rep1.ContextKey.Should().Be(ctx1);
        rep1.RelatedEntityId.Should().Be(rel1);
        rep1.NewContact.PersonalDetails!.FirstName.Should().Be("New");
        rep1.NewContact.PersonalDetails.LastName.Should().Be("One");
        rep1.NewContact.Id.Should().NotBe(old1.Id.ToString());

        var rep2 = result.Data.Replacements.Single(r => r.OldContactId == old2.Id);
        rep2.ContextKey.Should().Be(ctx2);
        rep2.RelatedEntityId.Should().Be(rel2);
        rep2.NewContact.PersonalDetails!.FirstName.Should().Be("New");
        rep2.NewContact.PersonalDetails.LastName.Should().Be("Two");
        rep2.NewContact.Id.Should().NotBe(old2.Id.ToString());

        // Assert — old contacts deleted from database
        var dbOld1 = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == old1.Id, Ct);
        var dbOld2 = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == old2.Id, Ct);
        dbOld1.Should().BeNull("old contact 1 should be deleted");
        dbOld2.Should().BeNull("old contact 2 should be deleted");

        // Assert — new contacts exist in database with correct ext-keys
        var newId1 = Guid.Parse(rep1.NewContact.Id);
        var newId2 = Guid.Parse(rep2.NewContact.Id);
        var dbNew1 = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == newId1, Ct);
        var dbNew2 = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == newId2, Ct);
        dbNew1.Should().NotBeNull();
        dbNew1!.ContextKey.Should().Be(ctx1);
        dbNew1.PersonalDetails!.FirstName.Should().Be("New");
        dbNew2.Should().NotBeNull();
        dbNew2!.ContextKey.Should().Be(ctx2);
        dbNew2.PersonalDetails!.FirstName.Should().Be("New");
    }

    #endregion

    #region No Existing Contact (Create-Only)

    /// <summary>
    /// Tests that when no existing contact exists at the ext-key, the handler still creates the new contact
    /// (with no replacement mapping since there was nothing old to map from).
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task NoExistingContact_CreatesNewWithEmptyReplacements()
    {
        // Arrange — no seed data
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"update-new-only-{suffix}";
        var relatedEntityId = Guid.NewGuid();

        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Fresh", LastName = "Contact" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — handler succeeded
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");

        // Assert — no replacements (nothing old to map)
        result.Data!.Replacements.Should().BeEmpty();

        // Assert — new contact was still created in the database
        var dbNew = await _db.Contacts.FirstOrDefaultAsync(
            c => c.ContextKey == contextKey && c.RelatedEntityId == relatedEntityId, Ct);
        dbNew.Should().NotBeNull("new contact should exist in database even without old contact");
        dbNew!.PersonalDetails!.FirstName.Should().Be("Fresh");
        dbNew.PersonalDetails.LastName.Should().Be("Contact");
    }

    #endregion

    #region Eviction Event Content

    /// <summary>
    /// Tests that the eviction event contains the old contact IDs and ext-keys that were replaced.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EvictionEvent_ContainsOldContactIdsAndExtKeys()
    {
        // Arrange — seed an existing contact
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"evict-update-{suffix}";
        var relatedEntityId = Guid.NewGuid();
        var oldContact = CreateTestContact(contextKey, relatedEntityId, "Old", "Evict");
        _db.Contacts.Add(oldContact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "Evict" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — handler succeeded
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");

        // Assert — eviction event was published
        _capturedEvictionInput.Should().NotBeNull("eviction event should have been published");
        var evt = _capturedEvictionInput!.Event;

        // Assert — EvictedContact entry with old contact ID + ext-key
        evt.Contacts.Should().HaveCount(1);
        evt.Contacts[0].ContactId.Should().Be(oldContact.Id.ToString());
        evt.Contacts[0].ContextKey.Should().Be(contextKey);
        evt.Contacts[0].RelatedEntityId.Should().Be(relatedEntityId.ToString());
    }

    /// <summary>
    /// Tests that no eviction event is published when there are no old contacts to replace.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task NoOldContacts_DoesNotPublishEvictionEvent()
    {
        // Arrange — no seed data
        var suffix = Guid.NewGuid().ToString("N");
        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = $"no-old-{suffix}",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Brand", LastName = "New" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert — no eviction event published (no old contacts → nothing to evict)
        _capturedEvictionInput.Should().BeNull("no eviction event should be published when no old contacts exist");
    }

    #endregion

    #region New Contact Has Different ID Than Old

    /// <summary>
    /// Tests that the new contact has a different PK than the old one (immutability invariant).
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task NewContact_HasDifferentIdThanOld()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"diff-id-{suffix}";
        var relatedEntityId = Guid.NewGuid();
        var oldContact = CreateTestContact(contextKey, relatedEntityId, "Old", "Id");
        _db.Contacts.Add(oldContact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "New", LastName = "Id" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Replacements.Should().HaveCount(1);
        var newContact = result.Data.Replacements[0].NewContact;
        Guid.Parse(newContact.Id).Should().NotBe(oldContact.Id, "replacement contact must have a new PK (immutability)");
        newContact.PersonalDetails!.FirstName.Should().Be("New", "must contain the NEW contact data, not old");
        newContact.PersonalDetails.LastName.Should().Be("Id");
    }

    #endregion

    #region Duplicate Ext-Key Validation

    /// <summary>
    /// Tests that duplicate ext-keys in the request are rejected with a validation error.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task DuplicateExtKeys_ReturnsValidationError()
    {
        // Arrange — two contacts with the same ext-key
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"dup-key-{suffix}";
        var relatedEntityId = Guid.NewGuid();

        var handler = CreateHandler();
        var request = new UpdateContactsByExtKeysRequest
        {
            Contacts =
            {
                new ContactToCreateDTO
                {
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "First", LastName = "Dup" },
                },
                new ContactToCreateDTO
                {
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "Second", LastName = "Dup" },
                },
            },
        };
        var input = new IComplex.UpdateContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — should fail with VALIDATION_FAILED
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
    }

    #endregion

    #region Helpers

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

    private static Contact CreateTestContact(string contextKey, Guid relatedEntityId, string firstName, string lastName)
    {
        return Contact.Create(
            contextKey: contextKey,
            relatedEntityId: relatedEntityId,
            personalDetails: Personal.Create(firstName, lastName: lastName));
    }

    private IComplex.IUpdateContactsByExtKeysHandler CreateHandler()
    {
        // Real repo handlers (against real PG)
        var getContactsByExtKeysRepo = new GetContactsByExtKeysRepo(_db, _options, _context);
        var deleteContactsRepo = new DeleteContactsRepo(_db, _options, _context);

        // Real CreateContacts app handler (uses real repos)
        var createContactsRepo = new CreateContactsRepo(_db, _context);
        var createLocationsRepo = new CreateLocationsRepo(_db, _options, _context);
        var getLocationsByIds = CreateGetLocationsByIdsHandler();
        var createContacts = new CreateContacts(createContactsRepo, createLocationsRepo, getLocationsByIds, _context);

        return new UpdateContactsByExtKeys(
            getContactsByExtKeysRepo, deleteContactsRepo, createContacts, _mockEviction.Object, _context);
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

    #endregion
}
