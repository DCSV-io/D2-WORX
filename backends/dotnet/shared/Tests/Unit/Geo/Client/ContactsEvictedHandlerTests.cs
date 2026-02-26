// -----------------------------------------------------------------------
// <copyright file="ContactsEvictedHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Geo.Client;

using D2.Events.Protos.V1;
using D2.Geo.Client;
using D2.Geo.Client.Messaging.Handlers.Sub;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using FluentAssertions;
using Moq;

/// <summary>
/// Unit tests for the Geo.Client <see cref="ContactsEvicted"/> handler.
/// Tests cache eviction for contact IDs and ext-key pairs.
/// </summary>
public class ContactsEvictedHandlerTests
{
    private readonly Mock<IDelete.IRemoveHandler> r_cacheRemoveMock;

    /// <summary>
    /// Initializes a new instance of the <see cref="ContactsEvictedHandlerTests"/> class.
    /// </summary>
    public ContactsEvictedHandlerTests()
    {
        r_cacheRemoveMock = new Mock<IDelete.IRemoveHandler>();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Eviction Tests

    /// <summary>
    /// Tests that handler evicts contact by ID from cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WithSingleContact_EvictsByContactId()
    {
        // Arrange
        SetupRemoveSuccess();
        var contactId = Guid.NewGuid();
        var input = CreateEvent(contactId, "auth_user", Guid.NewGuid());
        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        r_cacheRemoveMock.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i => i.Key == CacheKeys.Contact(contactId)),
                It.IsAny<CancellationToken>(),
                It.IsAny<D2.Shared.Handler.HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that handler evicts contact by ext-key pair from cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WithSingleContact_EvictsByExtKey()
    {
        // Arrange
        SetupRemoveSuccess();
        var contactId = Guid.NewGuid();
        var relatedEntityId = Guid.NewGuid();
        var input = CreateEvent(contactId, "auth_org_contact", relatedEntityId);
        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        r_cacheRemoveMock.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i =>
                    i.Key == CacheKeys.ContactsByExtKey("auth_org_contact", relatedEntityId)),
                It.IsAny<CancellationToken>(),
                It.IsAny<D2.Shared.Handler.HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that handler evicts all contacts when multiple are present.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WithMultipleContacts_EvictsAll()
    {
        // Arrange
        SetupRemoveSuccess();
        var event1 = new EvictedContact
        {
            ContactId = Guid.NewGuid().ToString(),
            ContextKey = "auth_user",
            RelatedEntityId = Guid.NewGuid().ToString(),
        };
        var event2 = new EvictedContact
        {
            ContactId = Guid.NewGuid().ToString(),
            ContextKey = "auth_org_contact",
            RelatedEntityId = Guid.NewGuid().ToString(),
        };
        var input = new ContactsEvictedEvent { Contacts = { event1, event2 } };
        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();

        // 2 contacts x 2 eviction calls (by ID + by ext-key) = 4 total
        r_cacheRemoveMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<D2.Shared.Handler.HandlerOptions?>()),
            Times.Exactly(4));
    }

    /// <summary>
    /// Tests that handler succeeds even when eviction fails (logs warning).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenEvictionFails_StillReturnsSuccess()
    {
        // Arrange
        r_cacheRemoveMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<D2.Shared.Handler.HandlerOptions?>()))
            .ReturnsAsync(D2Result<IDelete.RemoveOutput?>.Fail(["Cache remove failed"]));

        var contactId = Guid.NewGuid();
        var input = CreateEvent(contactId, "auth_user", Guid.NewGuid());
        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — should still succeed (eviction failure is non-fatal)
        result.Success.Should().BeTrue();
    }

    /// <summary>
    /// Tests that handler handles empty contact list gracefully.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WithEmptyContacts_ReturnsSuccess()
    {
        // Arrange
        var input = new ContactsEvictedEvent();
        var handler = CreateHandler();

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        r_cacheRemoveMock.Verify(
            x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<D2.Shared.Handler.HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Helper Methods

    private static ContactsEvictedEvent CreateEvent(
        Guid contactId,
        string contextKey,
        Guid relatedEntityId)
    {
        return new ContactsEvictedEvent
        {
            Contacts =
            {
                new EvictedContact
                {
                    ContactId = contactId.ToString(),
                    ContextKey = contextKey,
                    RelatedEntityId = relatedEntityId.ToString(),
                },
            },
        };
    }

    private ContactsEvicted CreateHandler()
    {
        var context = TestHelpers.CreateHandlerContext();
        return new ContactsEvicted(r_cacheRemoveMock.Object, context);
    }

    private void SetupRemoveSuccess()
    {
        r_cacheRemoveMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<D2.Shared.Handler.HandlerOptions?>()))
            .ReturnsAsync(D2Result<IDelete.RemoveOutput?>.Ok(new IDelete.RemoveOutput()));
    }

    #endregion
}
