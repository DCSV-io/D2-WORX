// -----------------------------------------------------------------------
// <copyright file="FingerprintBuilderTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Middleware.RequestEnrichment;

using D2.Shared.RequestEnrichment.Default;
using FluentAssertions;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Unit tests for the <see cref="FingerprintBuilder"/> static helper.
/// </summary>
public class FingerprintBuilderTests
{
    /// <summary>
    /// Tests that Build returns a 64-character hex string (SHA-256).
    /// </summary>
    [Fact]
    public void Build_ReturnsValidSha256Hash()
    {
        var context = CreateHttpContext();
        context.Request.Headers.UserAgent = "Mozilla/5.0";

        var result = FingerprintBuilder.Build(context);

        result.Should().HaveLength(64);
        result.Should().MatchRegex("^[0-9a-f]{64}$");
    }

    /// <summary>
    /// Tests that Build produces consistent results for the same headers.
    /// </summary>
    [Fact]
    public void Build_WithSameHeaders_ProducesSameFingerprint()
    {
        var context1 = CreateHttpContext();
        context1.Request.Headers.UserAgent = "Mozilla/5.0";
        context1.Request.Headers.AcceptLanguage = "en-US";
        context1.Request.Headers.AcceptEncoding = "gzip, deflate";
        context1.Request.Headers.Accept = "text/html";

        var context2 = CreateHttpContext();
        context2.Request.Headers.UserAgent = "Mozilla/5.0";
        context2.Request.Headers.AcceptLanguage = "en-US";
        context2.Request.Headers.AcceptEncoding = "gzip, deflate";
        context2.Request.Headers.Accept = "text/html";

        var result1 = FingerprintBuilder.Build(context1);
        var result2 = FingerprintBuilder.Build(context2);

        result1.Should().Be(result2);
    }

    /// <summary>
    /// Tests that Build produces different results for different User-Agent.
    /// </summary>
    [Fact]
    public void Build_WithDifferentUserAgent_ProducesDifferentFingerprint()
    {
        var context1 = CreateHttpContext();
        context1.Request.Headers.UserAgent = "Mozilla/5.0";

        var context2 = CreateHttpContext();
        context2.Request.Headers.UserAgent = "Chrome/100.0";

        var result1 = FingerprintBuilder.Build(context1);
        var result2 = FingerprintBuilder.Build(context2);

        result1.Should().NotBe(result2);
    }

    /// <summary>
    /// Tests that Build produces different results for different Accept-Language.
    /// </summary>
    [Fact]
    public void Build_WithDifferentAcceptLanguage_ProducesDifferentFingerprint()
    {
        var context1 = CreateHttpContext();
        context1.Request.Headers.UserAgent = "Mozilla/5.0";
        context1.Request.Headers.AcceptLanguage = "en-US";

        var context2 = CreateHttpContext();
        context2.Request.Headers.UserAgent = "Mozilla/5.0";
        context2.Request.Headers.AcceptLanguage = "de-DE";

        var result1 = FingerprintBuilder.Build(context1);
        var result2 = FingerprintBuilder.Build(context2);

        result1.Should().NotBe(result2);
    }

    /// <summary>
    /// Tests that Build produces different results for different Accept-Encoding.
    /// </summary>
    [Fact]
    public void Build_WithDifferentAcceptEncoding_ProducesDifferentFingerprint()
    {
        var context1 = CreateHttpContext();
        context1.Request.Headers.UserAgent = "Mozilla/5.0";
        context1.Request.Headers.AcceptEncoding = "gzip";

        var context2 = CreateHttpContext();
        context2.Request.Headers.UserAgent = "Mozilla/5.0";
        context2.Request.Headers.AcceptEncoding = "br";

        var result1 = FingerprintBuilder.Build(context1);
        var result2 = FingerprintBuilder.Build(context2);

        result1.Should().NotBe(result2);
    }

    /// <summary>
    /// Tests that Build produces different results for different Accept.
    /// </summary>
    [Fact]
    public void Build_WithDifferentAccept_ProducesDifferentFingerprint()
    {
        var context1 = CreateHttpContext();
        context1.Request.Headers.UserAgent = "Mozilla/5.0";
        context1.Request.Headers.Accept = "text/html";

        var context2 = CreateHttpContext();
        context2.Request.Headers.UserAgent = "Mozilla/5.0";
        context2.Request.Headers.Accept = "application/json";

        var result1 = FingerprintBuilder.Build(context1);
        var result2 = FingerprintBuilder.Build(context2);

        result1.Should().NotBe(result2);
    }

    /// <summary>
    /// Tests that Build handles missing headers gracefully.
    /// </summary>
    [Fact]
    public void Build_WithNoHeaders_ReturnsValidHash()
    {
        var context = CreateHttpContext();

        var result = FingerprintBuilder.Build(context);

        result.Should().HaveLength(64);
        result.Should().MatchRegex("^[0-9a-f]{64}$");
    }

    /// <summary>
    /// Tests that Build handles empty User-Agent gracefully.
    /// </summary>
    [Fact]
    public void Build_WithEmptyUserAgent_ReturnsValidHash()
    {
        var context = CreateHttpContext();
        context.Request.Headers.UserAgent = string.Empty;

        var result = FingerprintBuilder.Build(context);

        result.Should().HaveLength(64);
    }

    /// <summary>
    /// Tests that Build returns lowercase hex string.
    /// </summary>
    [Fact]
    public void Build_ReturnsLowercaseHex()
    {
        var context = CreateHttpContext();
        context.Request.Headers.UserAgent = "Test";

        var result = FingerprintBuilder.Build(context);

        result.Should().Be(result.ToLowerInvariant());
    }

    /// <summary>
    /// Tests that Build with typical browser headers produces expected format.
    /// </summary>
    [Fact]
    public void Build_WithTypicalBrowserHeaders_ProducesValidFingerprint()
    {
        var context = CreateHttpContext();
        context.Request.Headers.UserAgent =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        context.Request.Headers.AcceptLanguage = "en-US,en;q=0.9";
        context.Request.Headers.AcceptEncoding = "gzip, deflate, br";
        context.Request.Headers.Accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

        var result = FingerprintBuilder.Build(context);

        result.Should().HaveLength(64);
        result.Should().MatchRegex("^[0-9a-f]{64}$");
    }

    /// <summary>
    /// Creates a test HttpContext with default settings.
    /// </summary>
    private static DefaultHttpContext CreateHttpContext()
    {
        return new DefaultHttpContext();
    }
}
