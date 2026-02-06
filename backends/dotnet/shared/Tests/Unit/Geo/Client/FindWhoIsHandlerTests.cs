// -----------------------------------------------------------------------
// <copyright file="FindWhoIsHandlerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Geo.Client;

using D2.Geo.Client;
using D2.Geo.Client.CQRS.Handlers.X;
using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using D2.Services.Protos.Common.V1;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.R;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.U;
using D2.Shared.Result;
using FluentAssertions;
using Grpc.Core;
using Microsoft.Extensions.Options;
using Moq;

/// <summary>
/// Unit tests for the Geo.Client <see cref="FindWhoIs"/> handler.
/// Tests fail-open behavior when Geo service is unavailable.
/// </summary>
public class FindWhoIsHandlerTests
{
    private readonly Mock<IRead.IGetHandler<WhoIsDTO>> r_cacheGetMock;
    private readonly Mock<IUpdate.ISetHandler<WhoIsDTO>> r_cacheSetMock;
    private readonly Mock<GeoService.GeoServiceClient> r_geoClientMock;
    private readonly GeoClientOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="FindWhoIsHandlerTests"/> class.
    /// </summary>
    public FindWhoIsHandlerTests()
    {
        r_cacheGetMock = new Mock<IRead.IGetHandler<WhoIsDTO>>();
        r_cacheSetMock = new Mock<IUpdate.ISetHandler<WhoIsDTO>>();
        r_geoClientMock = new Mock<GeoService.GeoServiceClient>();

        r_options = new GeoClientOptions
        {
            WhoIsCacheExpiration = TimeSpan.FromHours(8),
            WhoIsCacheMaxEntries = 10_000,
        };
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Cache Hit Tests

    /// <summary>
    /// Tests that FindWhoIs returns cached data when cache hit occurs.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenCacheHit_ReturnsCachedData()
    {
        // Arrange
        var cachedWhoIs = CreateWhoIsDTO("192.168.1.1", "TestCity", "US");
        SetupCacheHit(cachedWhoIs);

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("192.168.1.1", "Mozilla/5.0");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIs.Should().NotBeNull();
        result.Data.WhoIs!.Location!.City.Should().Be("TestCity");
        result.Data.WhoIs.Location.CountryIso31661Alpha2Code.Should().Be("US");

        // Verify gRPC was NOT called
        r_geoClientMock.Verify(
            x => x.FindWhoIsAsync(
                It.IsAny<FindWhoIsRequest>(),
                It.IsAny<Metadata>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that FindWhoIs skips cache when cache returns failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenCacheFails_FallsBackToGrpc()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcSuccess("192.168.1.1", "GrpcCity", "DE");
        SetupCacheSetSuccess();

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("192.168.1.1", "Mozilla/5.0");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIs.Should().NotBeNull();
        result.Data.WhoIs!.Location!.City.Should().Be("GrpcCity");
    }

    #endregion

    #region gRPC Success Tests

    /// <summary>
    /// Tests that FindWhoIs calls gRPC on cache miss and returns data.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenCacheMissAndGrpcSuccess_ReturnsGrpcData()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcSuccess("8.8.8.8", "Mountain View", "US");
        SetupCacheSetSuccess();

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("8.8.8.8", "Chrome/120");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIs.Should().NotBeNull();
        result.Data.WhoIs!.Location!.City.Should().Be("Mountain View");
        result.Data.WhoIs.Location.CountryIso31661Alpha2Code.Should().Be("US");

        // Verify cache was populated
        r_cacheSetMock.Verify(
            x => x.HandleAsync(
                It.Is<IUpdate.SetInput<WhoIsDTO>>(i => i.Key.Contains("8.8.8.8")),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that FindWhoIs still returns data even if cache set fails.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenCacheSetFails_StillReturnsData()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcSuccess("1.1.1.1", "Sydney", "AU");
        SetupCacheSetFailure();

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("1.1.1.1", "Safari/16");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - Should still succeed even if caching failed
        result.Success.Should().BeTrue();
        result.Data!.WhoIs.Should().NotBeNull();
        result.Data.WhoIs!.Location!.City.Should().Be("Sydney");
    }

    #endregion

    #region Fail-Open Tests - CRITICAL

    /// <summary>
    /// CRITICAL: Tests that FindWhoIs returns Ok with null WhoIs when gRPC throws RpcException.
    /// This is the fail-open behavior that ensures the gateway continues working when Geo service is down.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenGrpcThrowsRpcException_FailsOpenWithNullWhoIs()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcThrows(new RpcException(new Status(StatusCode.Unavailable, "Geo service unavailable")));

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("192.168.1.1", "Mozilla/5.0");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert - MUST succeed with null WhoIs, NOT fail
        result.Success.Should().BeTrue("fail-open means we return success with null data");
        result.Data.Should().NotBeNull();
        result.Data!.WhoIs.Should().BeNull("WhoIs should be null when Geo service is unavailable");
    }

    /// <summary>
    /// CRITICAL: Tests that FindWhoIs returns Ok with null WhoIs when gRPC times out.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenGrpcTimesOut_FailsOpenWithNullWhoIs()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcThrows(new RpcException(new Status(StatusCode.DeadlineExceeded, "Request timed out")));

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("10.0.0.1", "Edge/120");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue("timeout should fail-open, not error");
        result.Data!.WhoIs.Should().BeNull();
    }

    /// <summary>
    /// CRITICAL: Tests that FindWhoIs returns Ok with null WhoIs when gRPC returns internal error.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenGrpcReturnsInternalError_FailsOpenWithNullWhoIs()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcThrows(new RpcException(new Status(StatusCode.Internal, "Internal server error")));

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("172.16.0.1", "Firefox/120");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue("internal error should fail-open");
        result.Data!.WhoIs.Should().BeNull();
    }

    /// <summary>
    /// CRITICAL: Tests that FindWhoIs returns Ok with null WhoIs when gRPC connection refused.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenGrpcConnectionRefused_FailsOpenWithNullWhoIs()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcThrows(new RpcException(new Status(StatusCode.Unavailable, "failed to connect to all addresses")));

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("203.0.113.1", "Chrome/121");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue("connection refused should fail-open");
        result.Data!.WhoIs.Should().BeNull();
    }

    /// <summary>
    /// Tests that FindWhoIs returns Ok with null WhoIs when gRPC returns empty response.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenGrpcReturnsEmptyResponse_ReturnsNullWhoIs()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcReturnsEmpty();

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("192.0.2.1", "Safari/17");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIs.Should().BeNull();
    }

    /// <summary>
    /// Tests that FindWhoIs returns Ok with null WhoIs when gRPC returns failure result.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_WhenGrpcReturnsFailureResult_ReturnsNullWhoIs()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcReturnsFailure();

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("198.51.100.1", "Opera/90");

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue("gRPC failure result should still return Ok with null");
        result.Data!.WhoIs.Should().BeNull();
    }

    #endregion

    #region Cache Key Tests

    /// <summary>
    /// Tests that cache key includes both IP and user agent.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous unit test.
    /// </returns>
    [Fact]
    public async Task HandleAsync_CacheKey_IncludesIpAndUserAgent()
    {
        // Arrange
        SetupCacheMiss();
        SetupGrpcSuccess("1.2.3.4", "TestCity", "GB");
        SetupCacheSetSuccess();

        var handler = CreateHandler();
        var input = new IComplex.FindWhoIsInput("1.2.3.4", "CustomUA/1.0");

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert - Verify cache key format
        r_cacheGetMock.Verify(
            x => x.HandleAsync(
                It.Is<IRead.GetInput>(i => i.Key == "whois:1.2.3.4:CustomUA/1.0"),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Helper Methods

    private static WhoIsDTO CreateWhoIsDTO(string ip, string city, string countryCode)
    {
        return new WhoIsDTO
        {
            HashId = Guid.NewGuid().ToString(),
            IpAddress = ip,
            Location = new LocationDTO
            {
                HashId = Guid.NewGuid().ToString(),
                City = city,
                CountryIso31661Alpha2Code = countryCode,
            },
        };
    }

    private FindWhoIs CreateHandler()
    {
        var options = Options.Create(r_options);
        var context = TestHelpers.CreateHandlerContext();
        return new FindWhoIs(
            r_cacheGetMock.Object,
            r_cacheSetMock.Object,
            r_geoClientMock.Object,
            options,
            context);
    }

    private void SetupCacheHit(WhoIsDTO whoIs)
    {
        r_cacheGetMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetOutput<WhoIsDTO>?>.Ok(
                new IRead.GetOutput<WhoIsDTO>(whoIs)));
    }

    private void SetupCacheMiss()
    {
        r_cacheGetMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IRead.GetInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IRead.GetOutput<WhoIsDTO>?>.Ok(
                new IRead.GetOutput<WhoIsDTO>(null!)));
    }

    private void SetupCacheSetSuccess()
    {
        r_cacheSetMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<WhoIsDTO>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IUpdate.SetOutput?>.Ok(new IUpdate.SetOutput()));
    }

    private void SetupCacheSetFailure()
    {
        r_cacheSetMock
            .Setup(x => x.HandleAsync(
                It.IsAny<IUpdate.SetInput<WhoIsDTO>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IUpdate.SetOutput?>.Fail(["Cache set failed"]));
    }

    private void SetupGrpcSuccess(string ip, string city, string countryCode)
    {
        var response = new FindWhoIsResponse
        {
            Result = new D2ResultProto { Success = true },
            Data =
            {
                new FindWhoIsData
                {
                    Whois = CreateWhoIsDTO(ip, city, countryCode),
                },
            },
        };

        r_geoClientMock
            .Setup(x => x.FindWhoIsAsync(
                It.IsAny<FindWhoIsRequest>(),
                It.IsAny<Metadata>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()))
            .Returns(new AsyncUnaryCall<FindWhoIsResponse>(
                Task.FromResult(response),
                Task.FromResult(new Metadata()),
                () => Status.DefaultSuccess,
                () => new Metadata(),
                () => { }));
    }

    private void SetupGrpcThrows(RpcException exception)
    {
        r_geoClientMock
            .Setup(x => x.FindWhoIsAsync(
                It.IsAny<FindWhoIsRequest>(),
                It.IsAny<Metadata>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()))
            .Returns(new AsyncUnaryCall<FindWhoIsResponse>(
                Task.FromException<FindWhoIsResponse>(exception),
                Task.FromResult(new Metadata()),
                () => Status.DefaultSuccess,
                () => new Metadata(),
                () => { }));
    }

    private void SetupGrpcReturnsEmpty()
    {
        var response = new FindWhoIsResponse
        {
            Result = new D2ResultProto { Success = true },
        };

        r_geoClientMock
            .Setup(x => x.FindWhoIsAsync(
                It.IsAny<FindWhoIsRequest>(),
                It.IsAny<Metadata>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()))
            .Returns(new AsyncUnaryCall<FindWhoIsResponse>(
                Task.FromResult(response),
                Task.FromResult(new Metadata()),
                () => Status.DefaultSuccess,
                () => new Metadata(),
                () => { }));
    }

    private void SetupGrpcReturnsFailure()
    {
        var response = new FindWhoIsResponse
        {
            Result = new D2ResultProto { Success = false },
        };

        r_geoClientMock
            .Setup(x => x.FindWhoIsAsync(
                It.IsAny<FindWhoIsRequest>(),
                It.IsAny<Metadata>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()))
            .Returns(new AsyncUnaryCall<FindWhoIsResponse>(
                Task.FromResult(response),
                Task.FromResult(new Metadata()),
                () => Status.DefaultSuccess,
                () => new Metadata(),
                () => { }));
    }

    #endregion
}
