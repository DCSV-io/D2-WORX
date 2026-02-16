// -----------------------------------------------------------------------
// <copyright file="FindWhoIsValidationTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Handlers.X;

using D2.Geo.App.Implementations.CQRS.Handlers.X;
using D2.Geo.App.Interfaces.CQRS.Handlers.X;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;
using Queries = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries;
using WhoIsProvider = D2.Geo.App.Interfaces.WhoIs.Handlers.R.IRead;

/// <summary>
/// Unit tests for the validation logic in the <see cref="FindWhoIs"/> complex CQRS handler.
/// </summary>
/// <remarks>
/// These tests exercise the handler's input validation path, including empty-request short-circuit,
/// per-item IP address validation, indexed error paths, and verification that dependencies are
/// never called when validation fails.
/// </remarks>
public class FindWhoIsValidationTests
{
    private readonly Mock<Queries.IGetWhoIsByIdsHandler> r_mockGetWhoIsByIds;
    private readonly Mock<Queries.IGetLocationsByIdsHandler> r_mockGetLocationsByIds;
    private readonly Mock<WhoIsProvider.IPopulateHandler> r_mockPopulateWhoIs;
    private readonly Mock<CreateRepo.ICreateWhoIsHandler> r_mockCreateWhoIs;
    private readonly IHandlerContext r_context;

    /// <summary>
    /// Initializes a new instance of the <see cref="FindWhoIsValidationTests"/> class.
    /// </summary>
    public FindWhoIsValidationTests()
    {
        r_mockGetWhoIsByIds = new Mock<Queries.IGetWhoIsByIdsHandler>();
        r_mockGetWhoIsByIds
            .Setup(x => x.HandleAsync(
                It.IsAny<Queries.GetWhoIsByIdsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<Queries.GetWhoIsByIdsOutput?>.Ok(
                new Queries.GetWhoIsByIdsOutput(new())));

        r_mockGetLocationsByIds = new Mock<Queries.IGetLocationsByIdsHandler>();
        r_mockGetLocationsByIds
            .Setup(x => x.HandleAsync(
                It.IsAny<Queries.GetLocationsByIdsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<Queries.GetLocationsByIdsOutput?>.Ok(
                new Queries.GetLocationsByIdsOutput(new())));

        r_mockPopulateWhoIs = new Mock<WhoIsProvider.IPopulateHandler>();
        r_mockPopulateWhoIs
            .Setup(x => x.HandleAsync(
                It.IsAny<WhoIsProvider.PopulateInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<WhoIsProvider.PopulateOutput?>.NotFound());

        r_mockCreateWhoIs = new Mock<CreateRepo.ICreateWhoIsHandler>();
        r_mockCreateWhoIs
            .Setup(x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateWhoIsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<CreateRepo.CreateWhoIsOutput?>.Ok(
                new CreateRepo.CreateWhoIsOutput(0)));

        r_context = CreateHandlerContext();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input

    /// <summary>
    /// Tests that an empty request list returns success with an empty dictionary.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ReturnsSuccessWithEmptyDictionary()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        var input = new IComplex.FindWhoIsInput(request);

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
    /// Tests that valid IPv4 and IPv6 addresses pass validation (no <see cref="ErrorCodes.VALIDATION_FAILED"/>).
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ValidIpAddresses_PassesValidation()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "192.168.1.1", Fingerprint = "test-fp" });
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "2001:0db8::1", Fingerprint = "test-fp-v6" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — the result may be OK or NOT_FOUND depending on mock setup,
        // but it must NOT be VALIDATION_FAILED.
        result.ErrorCode.Should().NotBe(ErrorCodes.VALIDATION_FAILED);
    }

    #endregion

    #region Single-Field Validation Failures

    /// <summary>
    /// Tests that an empty IP address returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyIpAddress_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = string.Empty, Fingerprint = "test-fp" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(1);
        result.InputErrors[0][0].Should().Be("requests[0].ipAddress");
        result.InputErrors[0][1].Should().Be("Must be a valid IPv4 or IPv6 address.");
    }

    /// <summary>
    /// Tests that a whitespace-only IP address returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task WhitespaceIpAddress_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "   ", Fingerprint = "test-fp" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(1);
        result.InputErrors[0][0].Should().Be("requests[0].ipAddress");
        result.InputErrors[0][1].Should().Be("Must be a valid IPv4 or IPv6 address.");
    }

    /// <summary>
    /// Tests that a non-IP string returns a validation failure with the correct error path.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidIpAddress_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "not-an-ip", Fingerprint = "test-fp" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(1);
        result.InputErrors[0][0].Should().Be("requests[0].ipAddress");
        result.InputErrors[0][1].Should().Be("Must be a valid IPv4 or IPv6 address.");
    }

    #endregion

    #region Multi-Item Validation

    /// <summary>
    /// Tests that indexed error paths are produced when multiple items have invalid IP addresses.
    /// Items at index 0 and 2 are invalid while item at index 1 is valid.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleInvalidIps_ReturnsIndexedErrorPaths()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "bad-ip-0", Fingerprint = "fp-0" });
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "10.0.0.1", Fingerprint = "fp-1" });
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "also-bad", Fingerprint = "fp-2" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(2);

        // Errors should reference requests[0] and requests[2] but NOT requests[1].
        result.InputErrors.Should().Contain(e => e[0] == "requests[0].ipAddress");
        result.InputErrors.Should().Contain(e => e[0] == "requests[2].ipAddress");
        result.InputErrors.Should().NotContain(e => e[0] == "requests[1].ipAddress");
    }

    /// <summary>
    /// Tests that when all items have invalid IP addresses, errors are collected for every item.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task AllInvalidIps_ReturnsAllErrors()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = string.Empty, Fingerprint = "fp-0" });
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "   ", Fingerprint = "fp-1" });
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "not-valid", Fingerprint = "fp-2" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().HaveCount(3);

        result.InputErrors.Should().Contain(e => e[0] == "requests[0].ipAddress");
        result.InputErrors.Should().Contain(e => e[0] == "requests[1].ipAddress");
        result.InputErrors.Should().Contain(e => e[0] == "requests[2].ipAddress");
    }

    #endregion

    #region Dependencies Not Called on Failure

    /// <summary>
    /// Tests that none of the four dependency handlers are called when validation fails.
    /// </summary>
    ///
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task DepsNotCalledWhenValidationFails()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new FindWhoIsRequest();
        request.Requests.Add(new FindWhoIsKeys { IpAddress = "not-an-ip", Fingerprint = "fp" });
        var input = new IComplex.FindWhoIsInput(request);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert
        r_mockGetWhoIsByIds.Verify(
            x => x.HandleAsync(
                It.IsAny<Queries.GetWhoIsByIdsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        r_mockGetLocationsByIds.Verify(
            x => x.HandleAsync(
                It.IsAny<Queries.GetLocationsByIdsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        r_mockPopulateWhoIs.Verify(
            x => x.HandleAsync(
                It.IsAny<WhoIsProvider.PopulateInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        r_mockCreateWhoIs.Verify(
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

    private FindWhoIs CreateHandler() =>
        new(
            r_mockGetWhoIsByIds.Object,
            r_mockGetLocationsByIds.Object,
            r_mockPopulateWhoIs.Object,
            r_mockCreateWhoIs.Object,
            r_context);

    #endregion
}
