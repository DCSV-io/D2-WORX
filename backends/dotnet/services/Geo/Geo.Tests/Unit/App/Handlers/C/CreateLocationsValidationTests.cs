// -----------------------------------------------------------------------
// <copyright file="CreateLocationsValidationTests.cs" company="DCSV">
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
/// Unit tests for the validation logic in the <see cref="CreateLocations"/> CQRS handler.
/// </summary>
/// <remarks>
/// These tests exercise the handler's input validation path, including empty-list short-circuit,
/// per-item <see cref="D2.Geo.App.Validators.LocationValidator"/> checks, indexed error paths,
/// and delegation to the repository handler on success.
/// </remarks>
public class CreateLocationsValidationTests
{
    private readonly Mock<CreateRepo.ICreateLocationsHandler> r_mockRepo;
    private readonly IHandlerContext r_context;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateLocationsValidationTests"/> class.
    /// </summary>
    public CreateLocationsValidationTests()
    {
        r_mockRepo = new Mock<CreateRepo.ICreateLocationsHandler>();
        r_mockRepo
            .Setup(x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateLocationsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<CreateRepo.CreateLocationsOutput?>.Ok(
                new CreateRepo.CreateLocationsOutput(1)));

        r_context = CreateHandlerContext();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input

    /// <summary>
    /// Tests that an empty location list returns success with an empty output list.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task EmptyInput_ReturnsSuccessWithEmptyList()
    {
        // Arrange
        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Valid Input

    /// <summary>
    /// Tests that valid locations pass validation and delegate to the repository handler.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ValidLocations_PassesValidationAndDelegatesToRepo()
    {
        // Arrange
        var location = Location.Create(
            city: "Portland",
            postalCode: "97201",
            subdivisionISO31662Code: "US-OR",
            countryISO31661Alpha2Code: "US");

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Data.Should().HaveCount(1);

        r_mockRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateLocationsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Single-Field Validation Failures

    /// <summary>
    /// Tests that a city exceeding 255 characters returns a validation failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task InvalidCity_TooLong_ReturnsValidationFailed()
    {
        // Arrange
        var location = new Location
        {
            HashId = "A".PadRight(64, 'A'),
            City = new string('X', 256),
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("city"));
    }

    /// <summary>
    /// Tests that a postal code exceeding 16 characters returns a validation failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task InvalidPostalCode_TooLong_ReturnsValidationFailed()
    {
        // Arrange
        var location = new Location
        {
            HashId = "B".PadRight(64, 'B'),
            PostalCode = new string('9', 17),
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("postalCode"));
    }

    /// <summary>
    /// Tests that a country code exceeding 2 characters returns a validation failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task InvalidCountryCode_TooLong_ReturnsValidationFailed()
    {
        // Arrange
        var location = new Location
        {
            HashId = "C".PadRight(64, 'C'),
            CountryISO31661Alpha2Code = "USA",
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([location]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().NotBeEmpty();
        result.InputErrors.Should().Contain(e => e[0].Contains("countryCode"));
    }

    #endregion

    #region Multi-Item Validation

    /// <summary>
    /// Tests that indexed error paths are produced when multiple items have validation errors.
    /// Items at index 0 and 2 are invalid while item at index 1 is valid.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task MultipleInvalidItems_ReturnsIndexedErrorPaths()
    {
        // Arrange
        var invalidItem0 = new Location
        {
            HashId = "A".PadRight(64, 'A'),
            City = new string('X', 256),
        };

        var validItem1 = Location.Create(city: "Portland", countryISO31661Alpha2Code: "US");

        var invalidItem2 = new Location
        {
            HashId = "C".PadRight(64, 'C'),
            PostalCode = new string('9', 17),
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([invalidItem0, validItem1, invalidItem2]);

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

    /// <summary>
    /// Tests that when all items are invalid, errors are collected for every item.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task AllItemsInvalid_ReturnsAllErrors()
    {
        // Arrange
        var item0 = new Location
        {
            HashId = "A".PadRight(64, 'A'),
            City = new string('X', 256),
        };

        var item1 = new Location
        {
            HashId = "B".PadRight(64, 'B'),
            PostalCode = new string('9', 17),
        };

        var item2 = new Location
        {
            HashId = "C".PadRight(64, 'C'),
            CountryISO31661Alpha2Code = "USA",
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([item0, item1, item2]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCountGreaterThanOrEqualTo(3);

        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[0]."));
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[1]."));
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[2]."));
    }

    #endregion

    #region Repo Not Called on Failure

    /// <summary>
    /// Tests that the repository handler is never called when validation fails.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task RepoNotCalledWhenValidationFails()
    {
        // Arrange
        var location = new Location
        {
            HashId = "D".PadRight(64, 'D'),
            City = new string('X', 256),
        };

        var handler = CreateHandler();
        var input = new CqrsCmd.CreateLocationsInput([location]);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert
        r_mockRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateLocationsInput>(),
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

    private CreateLocations CreateHandler() =>
        new(r_mockRepo.Object, r_context);

    #endregion
}
