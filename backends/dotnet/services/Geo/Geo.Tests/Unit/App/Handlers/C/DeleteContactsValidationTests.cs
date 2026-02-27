// -----------------------------------------------------------------------
// <copyright file="DeleteContactsValidationTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Handlers.C;

using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using CqrsCmd = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands;
using DeleteRepo = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete;
using IPubs = D2.Geo.App.Interfaces.Messaging.Handlers.Pub.IPubs;
using ReadRepo = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Unit tests for the validation logic in the <see cref="DeleteContacts"/> CQRS handler.
/// </summary>
/// <remarks>
/// These tests exercise the handler's input validation path, including empty-list short-circuit,
/// per-item empty GUID checks with indexed error paths, and delegation to the repository and
/// cache handlers on success.
/// </remarks>
public class DeleteContactsValidationTests
{
    private readonly Mock<DeleteRepo.IDeleteContactsHandler> r_mockRepo;
    private readonly Mock<IDelete.IRemoveHandler> r_mockCacheRemove;
    private readonly IHandlerContext r_context;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContactsValidationTests"/> class.
    /// </summary>
    public DeleteContactsValidationTests()
    {
        r_mockRepo = new Mock<DeleteRepo.IDeleteContactsHandler>();
        r_mockRepo
            .Setup(x => x.HandleAsync(
                It.IsAny<DeleteRepo.DeleteContactsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<DeleteRepo.DeleteContactsOutput?>.Ok(
                new DeleteRepo.DeleteContactsOutput(2)));

        r_mockCacheRemove = new Mock<IDelete.IRemoveHandler>();
        r_mockCacheRemove
            .Setup(x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IDelete.RemoveOutput?>.Ok(new IDelete.RemoveOutput()));

        r_context = CreateHandlerContext();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input

    /// <summary>
    /// Tests that an empty contact ID list returns success with zero deleted.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ReturnsSuccessWithZeroDeleted()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new CqrsCmd.DeleteContactsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Deleted.Should().Be(0);
    }

    #endregion

    #region Valid Input

    /// <summary>
    /// Tests that valid GUIDs pass validation and delegate to the repository handler.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ValidGuids_PassesValidationAndDelegatesToRepo()
    {
        // Arrange
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();

        var handler = CreateHandler();
        var input = new CqrsCmd.DeleteContactsInput([id1, id2]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Deleted.Should().Be(2);

        r_mockRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<DeleteRepo.DeleteContactsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Single Empty GUID Validation

    /// <summary>
    /// Tests that a single <see cref="Guid.Empty"/> returns a validation failure at items[0].
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyGuid_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new CqrsCmd.DeleteContactsInput([Guid.Empty]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(1);
        result.InputErrors[0][0].Should().Be("items[0]");
        result.InputErrors[0][1].Should().Be("Contact ID must not be an empty GUID.");
    }

    #endregion

    #region Multi-Item Validation

    /// <summary>
    /// Tests that indexed error paths are produced for each empty GUID in a mixed list.
    /// Items at index 1 and 3 are <see cref="Guid.Empty"/> while items at index 0 and 2 are valid.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleEmptyGuids_ReturnsIndexedErrorPaths()
    {
        // Arrange
        var validGuid1 = Guid.NewGuid();
        var validGuid2 = Guid.NewGuid();

        var handler = CreateHandler();
        var input = new CqrsCmd.DeleteContactsInput([validGuid1, Guid.Empty, validGuid2, Guid.Empty]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(2);

        result.InputErrors.Should().Contain(e => e[0] == "items[1]");
        result.InputErrors.Should().Contain(e => e[0] == "items[3]");
        result.InputErrors.Should().NotContain(e => e[0] == "items[0]");
        result.InputErrors.Should().NotContain(e => e[0] == "items[2]");
    }

    /// <summary>
    /// Tests that all items produce errors when every contact ID is <see cref="Guid.Empty"/>.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task AllEmptyGuids_ReturnsValidationFailedForAll()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new CqrsCmd.DeleteContactsInput([Guid.Empty, Guid.Empty, Guid.Empty]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(3);

        result.InputErrors.Should().Contain(e => e[0] == "items[0]");
        result.InputErrors.Should().Contain(e => e[0] == "items[1]");
        result.InputErrors.Should().Contain(e => e[0] == "items[2]");
    }

    #endregion

    #region Repo and Cache Not Called on Failure

    /// <summary>
    /// Tests that neither the repository handler nor the cache remove handler is called
    /// when validation fails.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RepoNotCalledWhenValidationFails()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new CqrsCmd.DeleteContactsInput([Guid.Empty]);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert
        r_mockRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<DeleteRepo.DeleteContactsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        r_mockCacheRemove.Verify(
            x => x.HandleAsync(
                It.IsAny<IDelete.RemoveInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Helpers

    private static IHandlerContext CreateHandlerContext()
    {
        var requestContext = new Mock<IRequestContext>();
        requestContext.Setup(x => x.TraceId).Returns("test-trace-id");

        var logger = new Mock<ILogger>();

        var context = new Mock<IHandlerContext>();
        context.Setup(x => x.Request).Returns(requestContext.Object);
        context.Setup(x => x.Logger).Returns(logger.Object);

        return context.Object;
    }

    private DeleteContacts CreateHandler()
    {
        var mockGetByIds = new Mock<ReadRepo.IGetContactsByIdsHandler>();
        mockGetByIds
            .Setup(x => x.HandleAsync(It.IsAny<ReadRepo.GetContactsByIdsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<ReadRepo.GetContactsByIdsOutput?>.Ok(new ReadRepo.GetContactsByIdsOutput([])));
        var mockEviction = new Mock<IPubs.IContactEvictionHandler>();
        mockEviction
            .Setup(x => x.HandleAsync(It.IsAny<IPubs.ContactEvictionInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IPubs.ContactEvictionOutput?>.Ok(new IPubs.ContactEvictionOutput()));
        return new(mockGetByIds.Object, r_mockRepo.Object, r_mockCacheRemove.Object, mockEviction.Object, r_context);
    }

    #endregion
}
