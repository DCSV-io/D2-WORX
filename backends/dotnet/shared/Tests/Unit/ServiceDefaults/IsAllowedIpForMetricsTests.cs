// -----------------------------------------------------------------------
// <copyright file="IsAllowedIpForMetricsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.ServiceDefaults;

using System.Net;
using D2.Shared.ServiceDefaults;
using FluentAssertions;

/// <summary>
/// Unit tests for the <see cref="Extensions.IsAllowedIpForMetrics"/> method.
/// Validates IP address filtering for Prometheus metrics endpoint access.
/// </summary>
public class IsAllowedIpForMetricsTests
{
    #region Allowed IPs

    /// <summary>
    /// Tests that IPv4 loopback (127.0.0.1) is allowed.
    /// </summary>
    [Fact]
    public void IsAllowedIpForMetrics_Ipv4Loopback_ReturnsTrue()
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Loopback)
            .Should().BeTrue();
    }

    /// <summary>
    /// Tests that IPv6 loopback (::1) is allowed.
    /// </summary>
    [Fact]
    public void IsAllowedIpForMetrics_Ipv6Loopback_ReturnsTrue()
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.IPv6Loopback)
            .Should().BeTrue();
    }

    /// <summary>
    /// Tests that 10.0.0.0/8 private range is allowed.
    /// </summary>
    /// <param name="ip">The IP to test.</param>
    [Theory]
    [InlineData("10.0.0.1")]
    [InlineData("10.255.255.255")]
    [InlineData("10.100.50.25")]
    public void IsAllowedIpForMetrics_Class10PrivateRange_ReturnsTrue(string ip)
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Parse(ip))
            .Should().BeTrue();
    }

    /// <summary>
    /// Tests that 172.16.0.0/12 private range is allowed.
    /// </summary>
    /// <param name="ip">The IP to test.</param>
    [Theory]
    [InlineData("172.16.0.1")]
    [InlineData("172.31.255.255")]
    [InlineData("172.20.10.5")]
    public void IsAllowedIpForMetrics_Class172PrivateRange_ReturnsTrue(string ip)
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Parse(ip))
            .Should().BeTrue();
    }

    /// <summary>
    /// Tests that 192.168.0.0/16 private range is allowed.
    /// </summary>
    /// <param name="ip">The IP to test.</param>
    [Theory]
    [InlineData("192.168.0.1")]
    [InlineData("192.168.255.255")]
    [InlineData("192.168.1.100")]
    public void IsAllowedIpForMetrics_Class192PrivateRange_ReturnsTrue(string ip)
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Parse(ip))
            .Should().BeTrue();
    }

    #endregion

    #region Denied IPs

    /// <summary>
    /// Tests that null IP is denied.
    /// </summary>
    [Fact]
    public void IsAllowedIpForMetrics_NullIp_ReturnsFalse()
    {
        Extensions.IsAllowedIpForMetrics(null)
            .Should().BeFalse();
    }

    /// <summary>
    /// Tests that public IPs are denied.
    /// </summary>
    /// <param name="ip">The IP to test.</param>
    [Theory]
    [InlineData("8.8.8.8")]
    [InlineData("1.1.1.1")]
    [InlineData("203.0.113.1")]
    [InlineData("198.51.100.50")]
    public void IsAllowedIpForMetrics_PublicIp_ReturnsFalse(string ip)
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Parse(ip))
            .Should().BeFalse();
    }

    /// <summary>
    /// Tests that 172.x addresses outside 172.16-31 range are denied.
    /// </summary>
    /// <param name="ip">The IP to test.</param>
    [Theory]
    [InlineData("172.15.255.255")]
    [InlineData("172.32.0.1")]
    public void IsAllowedIpForMetrics_Class172OutsidePrivateRange_ReturnsFalse(string ip)
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Parse(ip))
            .Should().BeFalse();
    }

    /// <summary>
    /// Tests that 192.x addresses outside 192.168 range are denied.
    /// </summary>
    /// <param name="ip">The IP to test.</param>
    [Theory]
    [InlineData("192.169.0.1")]
    [InlineData("192.167.0.1")]
    public void IsAllowedIpForMetrics_Class192OutsidePrivateRange_ReturnsFalse(string ip)
    {
        Extensions.IsAllowedIpForMetrics(IPAddress.Parse(ip))
            .Should().BeFalse();
    }

    #endregion
}
