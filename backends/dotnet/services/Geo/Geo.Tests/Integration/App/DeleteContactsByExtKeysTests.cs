// -----------------------------------------------------------------------
// <copyright file="DeleteContactsByExtKeysTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Events.Protos.V1;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using DeleteByExtKeysRepo = D2.Geo.Infra.Repository.Handlers.D.DeleteContactsByExtKeys;
using GetContactsByExtKeysRepo = D2.Geo.Infra.Repository.Handlers.R.GetContactsByExtKeys;
using IPubs = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs;

/// <summary>
/// Integration tests for the <see cref="DeleteContactsByExtKeys"/> CQRS handler.
/// Uses a real PostgreSQL database to verify deletion + eviction event content.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class DeleteContactsByExtKeysTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;
    private Mock<IDelete.IRemoveHandler> _mockCacheRemove = null!;
    private Mock<IPubs.IContactEvictionHandler> _mockEviction = null!;
    private IPubs.ContactEvictionInput? _capturedEvictionInput;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContactsByExtKeysTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public DeleteContactsByExtKeysTests(SharedPostgresFixture fixture)
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

        _mockCacheRemove = new Mock<IDelete.IRemoveHandler>();
        _mockCacheRemove
            .Setup(x => x.HandleAsync(It.IsAny<IDelete.RemoveInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IDelete.RemoveOutput?>.Ok(new IDelete.RemoveOutput()));

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

    #region Empty Input Tests

    /// <summary>
    /// Tests that an empty ext-key list returns success with zero deleted.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ReturnsZeroDeleted()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(0);

        _mockEviction.Verify(
            x => x.HandleAsync(It.IsAny<IPubs.ContactEvictionInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Single Ext-Key Deletion

    /// <summary>
    /// Tests that a single ext-key deletes the matching contact from the database.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SingleExtKey_DeletesMatchingContact()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"del-ext-{suffix}";
        var relatedEntityId = Guid.NewGuid();
        var contact = CreateTestContact(contextKey, relatedEntityId, "John", "Doe");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(contextKey, relatedEntityId)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Deleted.Should().Be(1);

        // Verify actually deleted from database
        var dbContact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contact.Id, Ct);
        dbContact.Should().BeNull();
    }

    #endregion

    #region Multiple Ext-Keys Deletion

    /// <summary>
    /// Tests that multiple ext-keys batch-delete all matching contacts from the database.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleExtKeys_DeletesAllMatchingContacts()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var ctx1 = $"multi-1-{suffix}";
        var ctx2 = $"multi-2-{suffix}";
        var rel1 = Guid.NewGuid();
        var rel2 = Guid.NewGuid();
        var contact1 = CreateTestContact(ctx1, rel1, "User", "One");
        var contact2 = CreateTestContact(ctx2, rel2, "User", "Two");
        _db.Contacts.AddRange(contact1, contact2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(ctx1, rel1), (ctx2, rel2)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Deleted.Should().Be(2);

        var remaining = await _db.Contacts
            .Where(c => c.Id == contact1.Id || c.Id == contact2.Id)
            .ToListAsync(Ct);
        remaining.Should().BeEmpty();
    }

    #endregion

    #region Non-Existent Ext-Key

    /// <summary>
    /// Tests that non-existent ext-keys return zero deleted (no error).
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task NonExistentExtKey_ReturnsZeroDeleted()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([("nonexistent-ctx", Guid.NewGuid())]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(0);
    }

    #endregion

    #region Validation

    /// <summary>
    /// Tests that an empty context key fails validation.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyContextKey_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(string.Empty, Guid.NewGuid())]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0] == "keys[0].contextKey");
    }

    /// <summary>
    /// Tests that an empty GUID fails validation.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyGuid_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([("valid-ctx", Guid.Empty)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0] == "keys[0].relatedEntityId");
    }

    /// <summary>
    /// Tests that validation errors include correct indices for each invalid key.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleInvalidKeys_ReturnsIndexedValidationErrors()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([
            ("valid-ctx", Guid.NewGuid()),
            (string.Empty, Guid.NewGuid()),
            ("another-valid", Guid.Empty),
        ]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0] == "keys[1].contextKey");
        result.InputErrors.Should().Contain(e => e[0] == "keys[2].relatedEntityId");
        result.InputErrors.Should().NotContain(e => e[0].StartsWith("keys[0]"));
    }

    #endregion

    #region Cache Invalidation

    /// <summary>
    /// Tests that cache remove is called once for each deleted contact.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task DeletedContacts_TriggersPerIdCacheInvalidation()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var ctx1 = $"cache-1-{suffix}";
        var ctx2 = $"cache-2-{suffix}";
        var rel1 = Guid.NewGuid();
        var rel2 = Guid.NewGuid();
        var contact1 = CreateTestContact(ctx1, rel1, "User", "One");
        var contact2 = CreateTestContact(ctx2, rel2, "User", "Two");
        _db.Contacts.AddRange(contact1, contact2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(ctx1, rel1), (ctx2, rel2)]);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert — cache remove called per deleted contact ID
        _mockCacheRemove.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i => i.Key.Contains(contact1.Id.ToString())),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
        _mockCacheRemove.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i => i.Key.Contains(contact2.Id.ToString())),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Eviction Event Content

    /// <summary>
    /// Tests that the eviction event contains both contact IDs and ext-keys.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EvictionEvent_ContainsBothContactIdsAndExtKeys()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var ctx1 = $"evict-1-{suffix}";
        var ctx2 = $"evict-2-{suffix}";
        var rel1 = Guid.NewGuid();
        var rel2 = Guid.NewGuid();
        var contact1 = CreateTestContact(ctx1, rel1, "Evict", "One");
        var contact2 = CreateTestContact(ctx2, rel2, "Evict", "Two");
        _db.Contacts.AddRange(contact1, contact2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(ctx1, rel1), (ctx2, rel2)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — handler succeeded
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");

        // Assert — eviction event was published
        _capturedEvictionInput.Should().NotBeNull("eviction event should have been published");
        var evt = _capturedEvictionInput!.Event;

        // Assert — EvictedContact entries present with all three fields
        evt.Contacts.Should().HaveCount(2);
        evt.Contacts.Should().Contain(c => c.ContactId == contact1.Id.ToString() && c.ContextKey == ctx1 && c.RelatedEntityId == rel1.ToString());
        evt.Contacts.Should().Contain(c => c.ContactId == contact2.Id.ToString() && c.ContextKey == ctx2 && c.RelatedEntityId == rel2.ToString());
    }

    /// <summary>
    /// Tests that no eviction event is published when no contacts are found.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task NoContactsFound_DoesNotPublishEvictionEvent()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([("nonexistent", Guid.NewGuid())]);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert — no eviction event published (0 contacts found → nothing to evict)
        _capturedEvictionInput.Should().BeNull("no eviction event should be published when no contacts exist at the ext-keys");
    }

    #endregion

    #region Idempotency

    /// <summary>
    /// Tests that deleting the same ext-keys twice is idempotent — first call deletes, second returns zero.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task DeleteTwice_IsIdempotent()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"idempotent-{suffix}";
        var relatedEntityId = Guid.NewGuid();
        var contact = CreateTestContact(contextKey, relatedEntityId, "Once", "Deleted");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(contextKey, relatedEntityId)]);

        // Act
        var result1 = await handler.HandleAsync(input, Ct);
        var result2 = await handler.HandleAsync(input, Ct);

        // Assert
        result1.Success.Should().BeTrue();
        result1.Data!.Deleted.Should().Be(1);

        result2.Success.Should().BeTrue();
        result2.Data!.Deleted.Should().Be(0);
    }

    #endregion

    #region Cross-Product False Positive Tests

    /// <summary>
    /// Tests that deleting cross-product pairs (contextA, entityB) does NOT delete contacts stored
    /// under (contextA, entityA) or (contextB, entityB). This verifies pair-wise matching in the
    /// delete query.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task CrossProductPairs_DoNotDeleteUnrelatedContacts()
    {
        // Arrange — Create two contacts with distinct (contextKey, relatedEntityId) pairs.
        var suffix = Guid.NewGuid().ToString("N");
        var contextA = $"xdel-a-{suffix}";
        var contextB = $"xdel-b-{suffix}";
        var entityA = Guid.NewGuid();
        var entityB = Guid.NewGuid();

        var contactA = CreateTestContact(contextA, entityA, "Alice", "Safe");
        var contactB = CreateTestContact(contextB, entityB, "Bob", "Safe");
        _db.Contacts.AddRange(contactA, contactB);
        await _db.SaveChangesAsync(Ct);

        // Act — Attempt to delete cross-product pairs that should NOT match either contact.
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(contextA, entityB), (contextB, entityA)]);

        var result = await handler.HandleAsync(input, Ct);

        // Assert — Nothing should be deleted.
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(0);

        // Verify both original contacts still exist in the database.
        var remaining = await _db.Contacts
            .Where(c => c.Id == contactA.Id || c.Id == contactB.Id)
            .ToListAsync(Ct);
        remaining.Should().HaveCount(2);
    }

    #endregion

    #region Mixed Existing / Non-Existing

    /// <summary>
    /// Tests that when some keys match contacts and some do not, only the matching
    /// contacts are deleted and the correct count is returned.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MixedExistingAndNonExisting_DeletesOnlyExistingAndReturnsCorrectCount()
    {
        // Arrange — Create 2 contacts; a third key will have no match.
        var suffix = Guid.NewGuid().ToString("N");
        var ctx1 = $"mix-1-{suffix}";
        var ctx2 = $"mix-2-{suffix}";
        var ctxMissing = $"mix-none-{suffix}";
        var rel1 = Guid.NewGuid();
        var rel2 = Guid.NewGuid();
        var relMissing = Guid.NewGuid();

        var contact1 = CreateTestContact(ctx1, rel1, "Found", "One");
        var contact2 = CreateTestContact(ctx2, rel2, "Found", "Two");
        _db.Contacts.AddRange(contact1, contact2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput(
            [(ctx1, rel1), (ctxMissing, relMissing), (ctx2, rel2)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — Only the 2 existing contacts should be deleted.
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(2);

        var remaining = await _db.Contacts
            .Where(c => c.Id == contact1.Id || c.Id == contact2.Id)
            .ToListAsync(Ct);
        remaining.Should().BeEmpty();
    }

    #endregion

    #region Duplicate Keys

    /// <summary>
    /// Tests that duplicate keys in the input are deduplicated and only one
    /// delete occurs per distinct (contextKey, relatedEntityId) pair.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task DuplicateKeys_StillDeletesSingleContact()
    {
        // Arrange — Create one contact, pass its key twice.
        var suffix = Guid.NewGuid().ToString("N");
        var contextKey = $"dup-{suffix}";
        var relatedEntityId = Guid.NewGuid();
        var contact = CreateTestContact(contextKey, relatedEntityId, "Once", "Only");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput(
            [(contextKey, relatedEntityId), (contextKey, relatedEntityId)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — Should deduplicate and delete exactly 1.
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(1);

        var dbContact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contact.Id, Ct);
        dbContact.Should().BeNull();
    }

    #endregion

    #region Same ContextKey, Different RelatedEntityIds

    /// <summary>
    /// Tests that when two contacts share the same context key but have different
    /// related entity IDs, deleting one does not affect the other.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SameContextKeyDifferentEntities_DeletesOnlyTargeted()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var sharedContext = $"same-ctx-{suffix}";
        var entityTarget = Guid.NewGuid();
        var entitySurvivor = Guid.NewGuid();

        var target = CreateTestContact(sharedContext, entityTarget, "Target", "Delete");
        var survivor = CreateTestContact(sharedContext, entitySurvivor, "Survivor", "Keep");
        _db.Contacts.AddRange(target, survivor);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(sharedContext, entityTarget)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(1);

        var targetDb = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == target.Id, Ct);
        targetDb.Should().BeNull();

        var survivorDb = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == survivor.Id, Ct);
        survivorDb.Should().NotBeNull();
    }

    #endregion

    #region Same RelatedEntityId, Different ContextKeys

    /// <summary>
    /// Tests that when two contacts share the same related entity ID but have different
    /// context keys, deleting one does not affect the other.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task SameEntityDifferentContextKeys_DeletesOnlyTargeted()
    {
        // Arrange
        var suffix = Guid.NewGuid().ToString("N");
        var contextTarget = $"ctx-target-{suffix}";
        var contextSurvivor = $"ctx-survivor-{suffix}";
        var sharedEntity = Guid.NewGuid();

        var target = CreateTestContact(contextTarget, sharedEntity, "Target", "Delete");
        var survivor = CreateTestContact(contextSurvivor, sharedEntity, "Survivor", "Keep");
        _db.Contacts.AddRange(target, survivor);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput([(contextTarget, sharedEntity)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(1);

        var targetDb = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == target.Id, Ct);
        targetDb.Should().BeNull();

        var survivorDb = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == survivor.Id, Ct);
        survivorDb.Should().NotBeNull();
    }

    #endregion

    #region Eviction Event With Mixed Results

    /// <summary>
    /// Tests that when some keys exist and some do not, the eviction event only
    /// contains the contacts that were actually found and deleted.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EvictionEvent_OnlyContainsDeletedContacts_NotMissingKeys()
    {
        // Arrange — Create one contact; the second key has no match.
        var suffix = Guid.NewGuid().ToString("N");
        var ctxFound = $"evict-found-{suffix}";
        var ctxMissing = $"evict-missing-{suffix}";
        var relFound = Guid.NewGuid();
        var relMissing = Guid.NewGuid();

        var contact = CreateTestContact(ctxFound, relFound, "Evict", "Found");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsByExtKeysInput(
            [(ctxFound, relFound), (ctxMissing, relMissing)]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(1);

        _capturedEvictionInput.Should().NotBeNull();
        var evt = _capturedEvictionInput!.Event;

        // Only the found contact should be in the eviction event.
        evt.Contacts.Should().HaveCount(1);
        evt.Contacts.Should().Contain(c =>
            c.ContactId == contact.Id.ToString()
            && c.ContextKey == ctxFound
            && c.RelatedEntityId == relFound.ToString());
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

    private ICommands.IDeleteContactsByExtKeysHandler CreateHandler()
    {
        var getByExtKeysRepo = new GetContactsByExtKeysRepo(_db, _options, _context);
        var deleteByExtKeysRepo = new DeleteByExtKeysRepo(_db, _options, _context);
        return new D2.Geo.App.Implementations.CQRS.Handlers.C.DeleteContactsByExtKeys(
            getByExtKeysRepo, deleteByExtKeysRepo, _mockCacheRemove.Object, _mockEviction.Object, _context);
    }

    #endregion
}
