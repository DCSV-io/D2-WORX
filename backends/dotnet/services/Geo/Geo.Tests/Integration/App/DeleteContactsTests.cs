// -----------------------------------------------------------------------
// <copyright file="DeleteContactsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Contracts.Interfaces.Caching.InMemory.Handlers.D;
using D2.Contracts.Result;
using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Geo.Tests.Fixtures;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using DeleteContactsRepo = D2.Geo.Infra.Repository.Handlers.D.DeleteContacts;

/// <summary>
/// Integration tests for the <see cref="DeleteContacts"/> CQRS handler.
/// </summary>
[Collection("SharedPostgres")]
[MustDisposeResource(value: false)]
public class DeleteContactsTests : IAsyncLifetime
{
    private readonly SharedPostgresFixture r_fixture;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;
    private Mock<IDelete.IRemoveHandler> _mockCacheRemove = null!;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContactsTests"/> class.
    /// </summary>
    ///
    /// <param name="fixture">
    /// The shared PostgreSQL fixture.
    /// </param>
    [MustDisposeResource(false)]
    public DeleteContactsTests(SharedPostgresFixture fixture)
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
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync().ConfigureAwait(false);
    }

    #region Empty Input Tests

    /// <summary>
    /// Tests that DeleteContacts with empty input returns success with zero deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_WithEmptyInput_ReturnsZeroDeleted()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(0);
    }

    #endregion

    #region Delete Single Contact Tests

    /// <summary>
    /// Tests that DeleteContacts deletes a single contact.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_WithSingleContact_DeletesContact()
    {
        // Arrange - Create a contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"test-context-{suffix}", "John", "Doe");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsInput([contact.Id]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Deleted.Should().Be(1);

        // Verify deleted from database
        var dbContact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contact.Id, Ct);
        dbContact.Should().BeNull();

        // Verify cache invalidation was called
        _mockCacheRemove.Verify(
            x => x.HandleAsync(
                It.Is<IDelete.RemoveInput>(i => i.Key.Contains(contact.Id.ToString())),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Delete Multiple Contacts Tests

    /// <summary>
    /// Tests that DeleteContacts deletes multiple contacts.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_WithMultipleContacts_DeletesAll()
    {
        // Arrange - Create multiple contacts with unique context keys
        var suffix = Guid.NewGuid().ToString("N");
        var contact1 = CreateTestContact($"ctx-1-{suffix}", "User", "One");
        var contact2 = CreateTestContact($"ctx-2-{suffix}", "User", "Two");
        var contact3 = CreateTestContact($"ctx-3-{suffix}", "User", "Three");
        _db.Contacts.AddRange(contact1, contact2, contact3);
        await _db.SaveChangesAsync(Ct);

        var contactIds = new[] { contact1.Id, contact2.Id, contact3.Id };
        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsInput([contact1.Id, contact2.Id, contact3.Id]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Deleted.Should().Be(3);

        // Verify all deleted from database
        var dbContacts = await _db.Contacts.Where(c => contactIds.Contains(c.Id)).ToListAsync(Ct);
        dbContacts.Should().BeEmpty();

        // Verify cache invalidation was called for each contact
        _mockCacheRemove.Verify(
            x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Exactly(3));
    }

    #endregion

    #region Non-Existent Contact Tests

    /// <summary>
    /// Tests that DeleteContacts with non-existent IDs returns zero deleted.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_WithNonExistentIds_ReturnsZeroDeleted()
    {
        // Arrange
        var handler = CreateHandler();
        var nonExistentIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() };
        var input = new ICommands.DeleteContactsInput(nonExistentIds);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Deleted.Should().Be(0);
    }

    /// <summary>
    /// Tests that DeleteContacts with mixed existing and non-existent IDs deletes only existing ones.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_WithMixedIds_DeletesOnlyExisting()
    {
        // Arrange - Create one contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"mixed-ctx-{suffix}", "Real", "Contact");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsInput([contact.Id, Guid.NewGuid(), Guid.NewGuid()]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Deleted.Should().Be(1);

        // Verify deleted from database
        var dbContact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contact.Id, Ct);
        dbContact.Should().BeNull();
    }

    #endregion

    #region Cache Invalidation Tests

    /// <summary>
    /// Tests that DeleteContacts continues even if cache invalidation fails.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_WhenCacheRemoveFails_StillSucceeds()
    {
        // Arrange - Create a contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"cache-fail-ctx-{suffix}", "Cache", "Fail");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        // Setup cache remove to fail
        _mockCacheRemove
            .Setup(x => x.HandleAsync(It.IsAny<IDelete.RemoveInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IDelete.RemoveOutput?>.Fail(["Cache remove failed"]));

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsInput([contact.Id]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - Should still succeed (cache failure is logged but doesn't fail the operation)
        result.Success.Should().BeTrue($"ErrorCode: {result.ErrorCode}, Messages: {string.Join(", ", result.Messages)}");
        result.Data!.Deleted.Should().Be(1);

        // Verify deleted from database
        var dbContact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contact.Id, Ct);
        dbContact.Should().BeNull();
    }

    #endregion

    #region Idempotency Tests

    /// <summary>
    /// Tests that DeleteContacts is idempotent - deleting the same IDs twice succeeds.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task DeleteContacts_CalledTwice_IsIdempotent()
    {
        // Arrange - Create a contact with unique context key
        var suffix = Guid.NewGuid().ToString("N");
        var contact = CreateTestContact($"idempotent-ctx-{suffix}", "Once", "Deleted");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var input = new ICommands.DeleteContactsInput([contact.Id]);

        // Act - Call twice
        var result1 = await handler.HandleAsync(input, Ct);
        var result2 = await handler.HandleAsync(input, Ct);

        // Assert
        result1.Success.Should().BeTrue($"ErrorCode: {result1.ErrorCode}, Messages: {string.Join(", ", result1.Messages)}");
        result1.Data!.Deleted.Should().Be(1);

        result2.Success.Should().BeTrue($"ErrorCode: {result2.ErrorCode}, Messages: {string.Join(", ", result2.Messages)}");
        result2.Data!.Deleted.Should().Be(0); // Already deleted

        // Verify contact is deleted from database
        var dbContact = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contact.Id, Ct);
        dbContact.Should().BeNull();
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

    private ICommands.IDeleteContactsHandler CreateHandler()
    {
        var deleteContactsRepo = new DeleteContactsRepo(_db, _options, _context);
        return new DeleteContacts(deleteContactsRepo, _mockCacheRemove.Object, _context);
    }
}
