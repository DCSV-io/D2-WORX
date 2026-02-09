// -----------------------------------------------------------------------
// <copyright file="CreateWhoIsValidationTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Handlers.C;

using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.Domain.Entities;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using CqrsCmd = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;

/// <summary>
/// Unit tests for the validation logic in the <see cref="CreateWhoIs"/> CQRS handler.
/// </summary>
/// <remarks>
/// These tests exercise the handler's input validation path, including empty-list short-circuit,
/// per-item <see cref="D2.Geo.App.Validators.WhoIsValidator"/> checks, indexed error paths,
/// and delegation to the repository handler on success.
/// </remarks>
public class CreateWhoIsValidationTests
{
    private readonly Mock<CreateRepo.ICreateWhoIsHandler> r_mockRepo;
    private readonly IHandlerContext r_context;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateWhoIsValidationTests"/> class.
    /// </summary>
    public CreateWhoIsValidationTests()
    {
        r_mockRepo = new Mock<CreateRepo.ICreateWhoIsHandler>();
        r_mockRepo
            .Setup(x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<CreateRepo.CreateWhoIsOutput?>.Ok(
                new CreateRepo.CreateWhoIsOutput(1)));

        r_context = CreateHandlerContext();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input

    /// <summary>
    /// Tests that an empty WhoIs list returns success with zero created.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ReturnsSuccessWithZeroCreated()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Created.Should().Be(0);
    }

    #endregion

    #region Valid Input

    /// <summary>
    /// Tests that valid WhoIs records pass validation and delegate to the repository handler.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ValidWhoIs_PassesValidationAndDelegatesToRepo()
    {
        // Arrange
        var whoIs = WhoIs.Create(
            ipAddress: "192.168.1.1",
            year: 2025,
            month: 6,
            fingerprint: "test-fp");

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Created.Should().Be(1);

        r_mockRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Single-Field Validation Failures

    /// <summary>
    /// Tests that an empty IP address returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidIpAddress_Empty_ReturnsValidationFailed()
    {
        // Arrange
        var whoIs = new WhoIs
        {
            HashId = new string('A', 64),
            IPAddress = string.Empty,
            Year = 2025,
            Month = 6,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("ipAddress"));
    }

    /// <summary>
    /// Tests that a non-IP string returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidIpAddress_NotAnIp_ReturnsValidationFailed()
    {
        // Arrange
        var whoIs = new WhoIs
        {
            HashId = new string('A', 64),
            IPAddress = "not-an-ip",
            Year = 2025,
            Month = 6,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("ipAddress"));
    }

    /// <summary>
    /// Tests that a month of zero returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidMonth_Zero_ReturnsValidationFailed()
    {
        // Arrange
        var whoIs = new WhoIs
        {
            HashId = new string('A', 64),
            IPAddress = "10.0.0.1",
            Year = 2025,
            Month = 0,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("month"));
    }

    /// <summary>
    /// Tests that a month of thirteen returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidMonth_Thirteen_ReturnsValidationFailed()
    {
        // Arrange
        var whoIs = new WhoIs
        {
            HashId = new string('A', 64),
            IPAddress = "10.0.0.1",
            Year = 2025,
            Month = 13,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("month"));
    }

    /// <summary>
    /// Tests that a year of zero returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidYear_Zero_ReturnsValidationFailed()
    {
        // Arrange
        var whoIs = new WhoIs
        {
            HashId = new string('A', 64),
            IPAddress = "10.0.0.1",
            Year = 0,
            Month = 6,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("year"));
    }

    #endregion

    #region Multi-Item Validation

    /// <summary>
    /// Tests that indexed error paths are produced when multiple items have validation errors.
    /// Items at index 0 and 2 are invalid while item at index 1 is valid.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleInvalidItems_ReturnsIndexedErrorPaths()
    {
        // Arrange — item 0 has invalid IP, item 1 is valid, item 2 has invalid month.
        var invalidItem0 = new WhoIs
        {
            HashId = new string('A', 64),
            IPAddress = string.Empty,
            Year = 2025,
            Month = 6,
        };

        var validItem1 = WhoIs.Create(
            ipAddress: "192.168.1.1",
            year: 2025,
            month: 6,
            fingerprint: "test-fp");

        var invalidItem2 = new WhoIs
        {
            HashId = new string('C', 64),
            IPAddress = "10.0.0.1",
            Year = 2025,
            Month = 13,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([invalidItem0, validItem1, invalidItem2]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();

        // Errors should reference items[0] and items[2] but NOT items[1].
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[0]."));
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[2]."));
        result.InputErrors.Should().NotContain(e => e[0].StartsWith("items[1]."));
    }

    #endregion

    #region Repo Not Called on Failure

    /// <summary>
    /// Tests that the repository handler is never called when validation fails.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RepoNotCalledWhenValidationFails()
    {
        // Arrange
        var whoIs = new WhoIs
        {
            HashId = new string('D', 64),
            IPAddress = string.Empty,
            Year = 2025,
            Month = 6,
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateWhoIsInput([whoIs]);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert
        r_mockRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateWhoIsInput>(),
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

    private CreateWhoIs CreateHandler() =>
        new(r_mockRepo.Object, r_context);

    #endregion
}
