// -----------------------------------------------------------------------
// <copyright file="IpResolverTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.RequestEnrichment;

using System.Net;
using D2.Shared.RequestEnrichment.Default;
using FluentAssertions;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Unit tests for the <see cref="IpResolver"/> static helper.
/// </summary>
public class IpResolverTests
{
    #region Resolve Tests

    /// <summary>
    /// Tests that Resolve returns CF-Connecting-IP when present (highest priority).
    /// </summary>
    [Fact]
    public void Resolve_WithCfConnectingIp_ReturnsCfConnectingIp()
    {
        var context = CreateHttpContext();
        context.Request.Headers["CF-Connecting-IP"] = "203.0.113.1";
        context.Request.Headers["X-Real-IP"] = "192.168.1.1";
        context.Request.Headers["X-Forwarded-For"] = "10.0.0.1";

        var result = IpResolver.Resolve(context);

        result.Should().Be("203.0.113.1");
    }

    /// <summary>
    /// Tests that Resolve returns X-Real-IP when CF-Connecting-IP is absent.
    /// </summary>
    [Fact]
    public void Resolve_WithXRealIp_WhenNoCfConnectingIp_ReturnsXRealIp()
    {
        var context = CreateHttpContext();
        context.Request.Headers["X-Real-IP"] = "192.168.1.1";
        context.Request.Headers["X-Forwarded-For"] = "10.0.0.1";

        var result = IpResolver.Resolve(context);

        result.Should().Be("192.168.1.1");
    }

    /// <summary>
    /// Tests that Resolve returns first IP from X-Forwarded-For when higher priority headers absent.
    /// </summary>
    [Fact]
    public void Resolve_WithXForwardedFor_WhenNoHigherPriorityHeaders_ReturnsFirstIp()
    {
        var context = CreateHttpContext();
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.50, 70.41.3.18, 150.172.238.178";

        var result = IpResolver.Resolve(context);

        result.Should().Be("203.0.113.50");
    }

    /// <summary>
    /// Tests that Resolve handles single IP in X-Forwarded-For correctly.
    /// </summary>
    [Fact]
    public void Resolve_WithSingleXForwardedFor_ReturnsThatIp()
    {
        var context = CreateHttpContext();
        context.Request.Headers["X-Forwarded-For"] = "198.51.100.178";

        var result = IpResolver.Resolve(context);

        result.Should().Be("198.51.100.178");
    }

    /// <summary>
    /// Tests that Resolve falls back to RemoteIpAddress when no headers present.
    /// </summary>
    [Fact]
    public void Resolve_WithNoHeaders_ReturnsRemoteIpAddress()
    {
        var context = CreateHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("192.0.2.1");

        var result = IpResolver.Resolve(context);

        result.Should().Be("192.0.2.1");
    }

    /// <summary>
    /// Tests that Resolve converts IPv4-mapped IPv6 addresses to IPv4.
    /// </summary>
    [Fact]
    public void Resolve_WithIpv4MappedIpv6_ReturnsIpv4()
    {
        var context = CreateHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:192.168.1.1");

        var result = IpResolver.Resolve(context);

        result.Should().Be("192.168.1.1");
    }

    /// <summary>
    /// Tests that Resolve returns "unknown" when no IP can be determined.
    /// </summary>
    [Fact]
    public void Resolve_WithNoIpAvailable_ReturnsUnknown()
    {
        var context = CreateHttpContext();

        var result = IpResolver.Resolve(context);

        result.Should().Be("unknown");
    }

    /// <summary>
    /// Tests that Resolve trims whitespace from header values.
    /// </summary>
    [Fact]
    public void Resolve_WithWhitespaceInHeader_TrimsWhitespace()
    {
        var context = CreateHttpContext();
        context.Request.Headers["CF-Connecting-IP"] = "  203.0.113.1  ";

        var result = IpResolver.Resolve(context);

        result.Should().Be("203.0.113.1");
    }

    /// <summary>
    /// Tests that Resolve skips empty CF-Connecting-IP header.
    /// </summary>
    [Fact]
    public void Resolve_WithEmptyCfConnectingIp_FallsBackToNextHeader()
    {
        var context = CreateHttpContext();
        context.Request.Headers["CF-Connecting-IP"] = "   ";
        context.Request.Headers["X-Real-IP"] = "192.168.1.1";

        var result = IpResolver.Resolve(context);

        result.Should().Be("192.168.1.1");
    }

    /// <summary>
    /// Tests that Resolve handles IPv6 addresses correctly.
    /// </summary>
    [Fact]
    public void Resolve_WithIpv6Address_ReturnsIpv6()
    {
        var context = CreateHttpContext();
        context.Request.Headers["CF-Connecting-IP"] = "2001:db8::1";

        var result = IpResolver.Resolve(context);

        result.Should().Be("2001:db8::1");
    }

    #endregion

    #region IsLocalhost Tests

    /// <summary>
    /// Tests that IsLocalhost returns true for "127.0.0.1".
    /// </summary>
    [Fact]
    public void IsLocalhost_With127001_ReturnsTrue()
    {
        var result = IpResolver.IsLocalhost("127.0.0.1");

        result.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IsLocalhost returns true for "::1".
    /// </summary>
    [Fact]
    public void IsLocalhost_WithIpv6Loopback_ReturnsTrue()
    {
        var result = IpResolver.IsLocalhost("::1");

        result.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IsLocalhost returns true for "localhost".
    /// </summary>
    [Fact]
    public void IsLocalhost_WithLocalhost_ReturnsTrue()
    {
        var result = IpResolver.IsLocalhost("localhost");

        result.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IsLocalhost returns true for "unknown".
    /// </summary>
    [Fact]
    public void IsLocalhost_WithUnknown_ReturnsTrue()
    {
        var result = IpResolver.IsLocalhost("unknown");

        result.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IsLocalhost returns false for public IP addresses.
    /// </summary>
    ///
    /// <param name="ip">The IP address to test.</param>
    [Theory]
    [InlineData("192.168.1.1")]
    [InlineData("10.0.0.1")]
    [InlineData("203.0.113.1")]
    [InlineData("2001:db8::1")]
    public void IsLocalhost_WithPublicIp_ReturnsFalse(string ip)
    {
        var result = IpResolver.IsLocalhost(ip);

        result.Should().BeFalse();
    }

    #endregion

    /// <summary>
    /// Creates a test HttpContext with default settings.
    /// </summary>
    private static DefaultHttpContext CreateHttpContext()
    {
        return new DefaultHttpContext();
    }
}
