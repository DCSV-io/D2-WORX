// -----------------------------------------------------------------------
// <copyright file="PopulateTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.Infra.WhoIs;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.App.Interfaces.Repository.Handlers.C;
using D2.Geo.App.Interfaces.WhoIs;
using D2.Geo.App.Interfaces.WhoIs.Handlers.R;
using D2.Geo.Domain.Entities;
using D2.Geo.Infra.WhoIs.Handlers.R;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

/// <summary>
/// Unit tests for the <see cref="Populate"/> WhoIs provider handler.
/// </summary>
public class PopulateTests
{
    private readonly Mock<IIpInfoClient> r_mockIpInfoClient;
    private readonly Mock<ICreate.ICreateLocationsHandler> r_mockCreateLocations;
    private readonly IHandlerContext r_context;

    /// <summary>
    /// Initializes a new instance of the <see cref="PopulateTests"/> class.
    /// </summary>
    public PopulateTests()
    {
        r_mockIpInfoClient = new Mock<IIpInfoClient>();
        r_mockCreateLocations = new Mock<ICreate.ICreateLocationsHandler>();
        r_mockCreateLocations
            .Setup(x => x.HandleAsync(It.IsAny<ICreate.CreateLocationsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<ICreate.CreateLocationsOutput?>.Ok(new ICreate.CreateLocationsOutput(0)));

        r_context = CreateHandlerContext();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input Tests

    /// <summary>
    /// Tests that Populate with empty input returns success with empty dictionary.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput([]);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().BeEmpty();

        // CreateLocations should not be called
        r_mockCreateLocations.Verify(
            x => x.HandleAsync(It.IsAny<ICreate.CreateLocationsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Localhost IP Tests

    /// <summary>
    /// Tests that Populate skips localhost IPv4 address.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithLocalhostIPv4_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var partialWhoIs = WhoIs.Create(
            ipAddress: "127.0.0.1",
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().BeEmpty();

        // IpInfoClient should not be called for localhost
        r_mockIpInfoClient.Verify(
            x => x.GetDetailsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that Populate skips localhost IPv6 address.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithLocalhostIPv6_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var partialWhoIs = WhoIs.Create(
            ipAddress: "::1",
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().BeEmpty();

        // IpInfoClient should not be called for localhost
        r_mockIpInfoClient.Verify(
            x => x.GetDetailsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    #endregion

    #region API Response Tests (exercises BuildPopulatedWhoIs and ExtractLocation)

    /// <summary>
    /// Tests that Populate correctly populates WhoIs from full API response with location.
    /// This exercises both BuildPopulatedWhoIs and ExtractLocation methods.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithFullApiResponse_PopulatesWhoIsAndCreatesLocation()
    {
        // Arrange
        var ipAddress = "8.8.8.8";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IpInfoResponse
            {
                Ip = ipAddress,
                City = "Mountain View",
                Region = "California",
                Country = "US",
                Postal = "94043",
                Latitude = "37.4056",
                Longitude = "-122.0775",
                Org = "AS15169 Google LLC",
                Privacy = new IpInfoPrivacy
                {
                    Vpn = false,
                    Proxy = false,
                    Tor = false,
                    Relay = false,
                    Hosting = true,
                },
            });

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().HaveCount(1);

        var populatedWhoIs = result.Data.WhoIsRecords[partialWhoIs.HashId];
        populatedWhoIs.IPAddress.Should().Be(ipAddress);
        populatedWhoIs.Year.Should().Be(2025);
        populatedWhoIs.Month.Should().Be(6);
        populatedWhoIs.Fingerprint.Should().Be("test-fingerprint");
        populatedWhoIs.ASN.Should().Be(15169);
        populatedWhoIs.ASName.Should().Be("Google LLC");
        populatedWhoIs.IsHosting.Should().BeTrue();
        populatedWhoIs.IsVPN.Should().BeFalse();
        populatedWhoIs.IsProxy.Should().BeFalse();
        populatedWhoIs.IsTor.Should().BeFalse();
        populatedWhoIs.IsRelay.Should().BeFalse();
        populatedWhoIs.LocationHashId.Should().NotBeNullOrEmpty();

        // CreateLocations should be called once
        r_mockCreateLocations.Verify(
            x => x.HandleAsync(It.IsAny<ICreate.CreateLocationsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that Populate handles API response with minimal location data.
    /// This exercises ExtractLocation with partial location fields.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithMinimalLocationData_PopulatesWhoIsWithLocation()
    {
        // Arrange
        var ipAddress = "1.1.1.1";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "cloudflare-test");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IpInfoResponse
            {
                Ip = ipAddress,
                City = "San Francisco",
                Country = "US",
            });

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().HaveCount(1);

        var populatedWhoIs = result.Data.WhoIsRecords[partialWhoIs.HashId];
        populatedWhoIs.LocationHashId.Should().NotBeNullOrEmpty();

        // CreateLocations should be called
        r_mockCreateLocations.Verify(
            x => x.HandleAsync(It.IsAny<ICreate.CreateLocationsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that Populate handles API response with no location data.
    /// This exercises ExtractLocation returning null.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithNoLocationData_PopulatesWhoIsWithoutLocation()
    {
        // Arrange
        var ipAddress = "192.0.2.1";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IpInfoResponse
            {
                Ip = ipAddress,
                Org = "AS64496 Example ISP",
            });

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().HaveCount(1);

        var populatedWhoIs = result.Data.WhoIsRecords[partialWhoIs.HashId];
        populatedWhoIs.ASN.Should().Be(64496);
        populatedWhoIs.ASName.Should().Be("Example ISP");
        populatedWhoIs.LocationHashId.Should().BeNull();

        // CreateLocations should NOT be called when no locations to create
        r_mockCreateLocations.Verify(
            x => x.HandleAsync(It.IsAny<ICreate.CreateLocationsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    /// <summary>
    /// Tests that Populate handles API returning null (failed lookup).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WhenApiReturnsNull_ReturnsEmptyDictionary()
    {
        // Arrange
        var ipAddress = "203.0.113.1";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync((IpInfoResponse?)null);

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that Populate correctly parses ASN from org field variations.
    /// </summary>
    ///
    /// <param name="org">
    /// The organization string in IPinfo format (e.g., "AS12345 ISP Name").
    /// </param>
    /// <param name="expectedAsn">
    /// The expected parsed ASN number.
    /// </param>
    /// <param name="expectedAsName">
    /// The expected parsed AS name.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Theory]
    [InlineData("AS12345 Some ISP Name", 12345, "Some ISP Name")]
    [InlineData("AS1 Minimal", 1, "Minimal")]
    [InlineData("as9999 lowercase prefix", 9999, "lowercase prefix")]
    public async Task Populate_WithVariousOrgFormats_ParsesAsnCorrectly(
        string org,
        int expectedAsn,
        string expectedAsName)
    {
        // Arrange
        var ipAddress = "10.0.0.1";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IpInfoResponse
            {
                Ip = ipAddress,
                Org = org,
            });

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        var populatedWhoIs = result.Data!.WhoIsRecords[partialWhoIs.HashId];
        populatedWhoIs.ASN.Should().Be(expectedAsn);
        populatedWhoIs.ASName.Should().Be(expectedAsName);
    }

    /// <summary>
    /// Tests that Populate handles multiple records with shared location (deduplication).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithMultipleRecordsSameLocation_DeduplicatesLocations()
    {
        // Arrange
        var ip1 = "8.8.8.8";
        var ip2 = "8.8.4.4";

        var whoIs1 = WhoIs.Create(ip1, 2025, 6, "fp1");
        var whoIs2 = WhoIs.Create(ip2, 2025, 6, "fp2");

        // Both IPs return same location data
        var sharedLocationResponse = new IpInfoResponse
        {
            City = "Mountain View",
            Country = "US",
            Postal = "94043",
            Latitude = "37.4056",
            Longitude = "-122.0775",
        };

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ip1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(sharedLocationResponse with { Ip = ip1, Org = "AS15169 Google LLC" });

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ip2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(sharedLocationResponse with { Ip = ip2, Org = "AS15169 Google LLC" });

        ICreate.CreateLocationsInput? capturedInput = null;
        r_mockCreateLocations
            .Setup(x => x.HandleAsync(It.IsAny<ICreate.CreateLocationsInput>(), It.IsAny<CancellationToken>(), It.IsAny<HandlerOptions?>()))
            .Callback<ICreate.CreateLocationsInput, CancellationToken, HandlerOptions?>((input, _, _) => capturedInput = input)
            .ReturnsAsync(D2Result<ICreate.CreateLocationsOutput?>.Ok(new ICreate.CreateLocationsOutput(1)));

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [whoIs1.HashId] = whoIs1,
            [whoIs2.HashId] = whoIs2,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().HaveCount(2);

        // Both WhoIs records should have the same location hash ID
        var populated1 = result.Data.WhoIsRecords[whoIs1.HashId];
        var populated2 = result.Data.WhoIsRecords[whoIs2.HashId];
        populated1.LocationHashId.Should().Be(populated2.LocationHashId);

        // Only one location should be created (deduplicated)
        capturedInput.Should().NotBeNull();
        capturedInput!.Locations.Should().HaveCount(1);
    }

    /// <summary>
    /// Tests that Populate handles invalid coordinate values gracefully.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithInvalidCoordinates_CreatesLocationWithoutCoordinates()
    {
        // Arrange
        var ipAddress = "198.51.100.1";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IpInfoResponse
            {
                Ip = ipAddress,
                City = "Test City",
                Country = "US",
                Latitude = "invalid",
                Longitude = "also-invalid",
            });

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().HaveCount(1);

        // Location should still be created (just without coordinates)
        var populatedWhoIs = result.Data.WhoIsRecords[partialWhoIs.HashId];
        populatedWhoIs.LocationHashId.Should().NotBeNullOrEmpty();
    }

    /// <summary>
    /// Tests that Populate handles out-of-range coordinates gracefully.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Populate_WithOutOfRangeCoordinates_CreatesLocationWithoutCoordinates()
    {
        // Arrange
        var ipAddress = "198.51.100.2";
        var partialWhoIs = WhoIs.Create(
            ipAddress: ipAddress,
            year: 2025,
            month: 6,
            fingerprint: "test-fingerprint");

        r_mockIpInfoClient
            .Setup(x => x.GetDetailsAsync(ipAddress, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IpInfoResponse
            {
                Ip = ipAddress,
                City = "Test City",
                Country = "US",
                Latitude = "999.999",  // Invalid: latitude must be -90 to 90
                Longitude = "-200.5",  // Invalid: longitude must be -180 to 180
            });

        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);
        var input = new IRead.PopulateInput(new Dictionary<string, WhoIs>
        {
            [partialWhoIs.HashId] = partialWhoIs,
        });

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.WhoIsRecords.Should().HaveCount(1);

        // Location should still be created (coordinates exception is caught)
        var populatedWhoIs = result.Data.WhoIsRecords[partialWhoIs.HashId];
        populatedWhoIs.LocationHashId.Should().NotBeNullOrEmpty();
    }

    #endregion

    #region Handler Construction Tests

    /// <summary>
    /// Tests that handler can be constructed with valid dependencies.
    /// </summary>
    [Fact]
    public void Populate_WithValidDependencies_CanBeConstructed()
    {
        // Act
        var handler = new Populate(r_mockIpInfoClient.Object, r_mockCreateLocations.Object, r_context);

        // Assert
        handler.Should().NotBeNull();
    }

    #endregion

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
}
