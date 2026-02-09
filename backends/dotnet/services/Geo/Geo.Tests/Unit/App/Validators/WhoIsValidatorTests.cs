// -----------------------------------------------------------------------
// <copyright file="WhoIsValidatorTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Validators;

using D2.Geo.App.Validators;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.Exceptions;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for the <see cref="WhoIsValidator"/> aggregate validator.
/// Includes domain parity tests ensuring Fluent validation is at least as strict
/// as domain factory constraints.
/// </summary>
public class WhoIsValidatorTests
{
    #region Valid WhoIs

    /// <summary>
    /// Tests that a minimal valid WhoIs passes validation.
    /// </summary>
    [Fact]
    public void Validate_MinimalValidWhoIs_Passes()
    {
        var whoIs = WhoIs.Create("192.168.1.1");
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that a full valid WhoIs passes validation.
    /// </summary>
    [Fact]
    public void Validate_FullValidWhoIs_Passes()
    {
        var whoIs = WhoIs.Create(
            "2001:db8::1",
            year: 2025,
            month: 6,
            fingerprint: "Mozilla/5.0");
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region Domain Parity — IP Address

    /// <summary>
    /// Tests that invalid IP addresses are rejected by the domain factory.
    /// Fluent cannot validate these since domain construction throws first.
    /// </summary>
    /// <param name="ip">The invalid IP address to test.</param>
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not-an-ip")]
    [InlineData("999.999.999.999")]
    public void DomainParity_InvalidIp_DomainThrows(string ip)
    {
        var act = () => WhoIs.Create(ipAddress: ip);
        act.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that null IP address is rejected by domain (uses named parameter to avoid overload ambiguity).
    /// </summary>
    [Fact]
    public void DomainParity_NullIp_DomainThrows()
    {
        var act = () => WhoIs.Create(ipAddress: null!);
        act.Should().Throw<GeoValidationException>();
    }

    #endregion

    #region Domain Parity — Month

    /// <summary>
    /// Tests that invalid months are rejected by the domain factory.
    /// </summary>
    /// <param name="month">The invalid month value to test.</param>
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(13)]
    [InlineData(100)]
    public void DomainParity_InvalidMonth_DomainThrows(int month)
    {
        var act = () => WhoIs.Create("192.168.1.1", month: month);
        act.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that boundary months pass both Fluent and domain.
    /// </summary>
    /// <param name="month">The boundary month value to test.</param>
    [Theory]
    [InlineData(1)]
    [InlineData(12)]
    public void Validate_BoundaryMonth_Passes(int month)
    {
        var whoIs = WhoIs.Create("192.168.1.1", month: month);
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region Domain Parity — Year

    /// <summary>
    /// Tests that invalid years are rejected by domain.
    /// </summary>
    /// <param name="year">The invalid year value to test.</param>
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(10000)]
    public void DomainParity_InvalidYear_DomainThrows(int year)
    {
        var act = () => WhoIs.Create("192.168.1.1", year);
        act.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that boundary years pass both Fluent and domain.
    /// </summary>
    /// <param name="year">The boundary year value to test.</param>
    [Theory]
    [InlineData(1)]
    [InlineData(9999)]
    public void Validate_BoundaryYear_Passes(int year)
    {
        var whoIs = WhoIs.Create("192.168.1.1", year);
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region HashId Validation

    /// <summary>
    /// Tests that a valid HashId passes validation.
    /// </summary>
    [Fact]
    public void Validate_ValidHashId_Passes()
    {
        var whoIs = WhoIs.Create("192.168.1.1", 2025, 6);
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeTrue();
        whoIs.HashId.Should().HaveLength(64);
    }

    #endregion

    #region Fingerprint Max Length

    /// <summary>
    /// Tests that fingerprint within max length passes.
    /// </summary>
    [Fact]
    public void Validate_FingerprintWithinMaxLength_Passes()
    {
        var whoIs = WhoIs.Create("192.168.1.1", fingerprint: new string('A', 2048));
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that fingerprint exceeding max length fails.
    /// </summary>
    [Fact]
    public void Validate_FingerprintTooLong_Fails()
    {
        var whoIs = WhoIs.Create("192.168.1.1", fingerprint: new string('A', 2049));
        var validator = new WhoIsValidator();
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "fingerprint");
    }

    #endregion

    #region Index Prefix

    /// <summary>
    /// Tests that indexed error paths use the provided prefix.
    /// </summary>
    [Fact]
    public void Validate_WithIndexPrefix_ErrorPathsIncludePrefix()
    {
        var whoIs = WhoIs.Create("192.168.1.1", fingerprint: new string('A', 2049));
        var validator = new WhoIsValidator("items[3].");
        var result = validator.Validate(whoIs);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.StartsWith("items[3]."));
    }

    #endregion
}
