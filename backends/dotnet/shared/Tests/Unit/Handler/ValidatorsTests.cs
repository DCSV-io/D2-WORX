// -----------------------------------------------------------------------
// <copyright file="ValidatorsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Handler;

using D2.Shared.Handler;
using FluentAssertions;
using FluentValidation;
using Xunit;

/// <summary>
/// Unit tests for the common <see cref="Validators"/> FluentValidation extensions.
/// </summary>
public class ValidatorsTests
{
    #region IsValidIpAddress

    /// <summary>
    /// Tests that valid IPv4 addresses pass validation.
    /// </summary>
    /// <param name="ip">The IPv4 address to validate.</param>
    [Theory]
    [InlineData("192.168.1.1")]
    [InlineData("0.0.0.0")]
    [InlineData("255.255.255.255")]
    [InlineData("127.0.0.1")]
    [InlineData("10.0.0.1")]
    public void IsValidIpAddress_WithValidIPv4_Passes(string ip)
    {
        var validator = new IpAddressTestValidator();
        var result = validator.Validate(new IpTestModel(ip));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that valid IPv6 addresses pass validation.
    /// </summary>
    /// <param name="ip">The IPv6 address to validate.</param>
    [Theory]
    [InlineData("::1")]
    [InlineData("2001:db8::1")]
    [InlineData("fe80::1")]
    [InlineData("::ffff:192.168.1.1")]
    public void IsValidIpAddress_WithValidIPv6_Passes(string ip)
    {
        var validator = new IpAddressTestValidator();
        var result = validator.Validate(new IpTestModel(ip));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that invalid IP addresses fail validation.
    /// </summary>
    /// <param name="ip">The invalid IP address to validate.</param>
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not-an-ip")]
    [InlineData("256.1.1.1")]
    [InlineData("abc")]
    public void IsValidIpAddress_WithInvalidIP_Fails(string ip)
    {
        var validator = new IpAddressTestValidator();
        var result = validator.Validate(new IpTestModel(ip));
        result.IsValid.Should().BeFalse();
    }

    /// <summary>
    /// Tests that null IP address fails validation.
    /// </summary>
    [Fact]
    public void IsValidIpAddress_WithNull_Fails()
    {
        var validator = new IpAddressTestValidator();
        var result = validator.Validate(new IpTestModel(null!));
        result.IsValid.Should().BeFalse();
    }

    #endregion

    #region IsValidHashId

    /// <summary>
    /// Tests that valid 64-char hex strings pass validation.
    /// </summary>
    /// <param name="hashId">The hash ID to validate.</param>
    [Theory]
    [InlineData("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    [InlineData("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")]
    public void IsValidHashId_WithValid64CharHex_Passes(string hashId)
    {
        var validator = new HashIdTestValidator();
        var result = validator.Validate(new StringTestModel(hashId));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that invalid hash IDs fail validation.
    /// </summary>
    /// <param name="hashId">The invalid hash ID to validate.</param>
    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG1")]
    public void IsValidHashId_WithInvalidHash_Fails(string hashId)
    {
        var validator = new HashIdTestValidator();
        var result = validator.Validate(new StringTestModel(hashId));
        result.IsValid.Should().BeFalse();
    }

    /// <summary>
    /// Tests that hash IDs with wrong length fail.
    /// </summary>
    /// <param name="hashId">The wrong-length hash ID to validate.</param>
    [Theory]
    [InlineData("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85")]
    [InlineData("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8555")]
    public void IsValidHashId_WithWrongLength_Fails(string hashId)
    {
        var validator = new HashIdTestValidator();
        var result = validator.Validate(new StringTestModel(hashId));
        result.IsValid.Should().BeFalse();
    }

    #endregion

    #region IsValidGuid

    /// <summary>
    /// Tests that valid UUIDs pass validation.
    /// </summary>
    /// <param name="guid">The UUID to validate.</param>
    [Theory]
    [InlineData("550e8400-e29b-41d4-a716-446655440000")]
    [InlineData("00000000-0000-0000-0000-000000000001")]
    public void IsValidGuid_WithValidUuid_Passes(string guid)
    {
        var validator = new GuidTestValidator();
        var result = validator.Validate(new StringTestModel(guid));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that invalid UUIDs fail validation.
    /// </summary>
    /// <param name="guid">The invalid UUID to validate.</param>
    [Theory]
    [InlineData("")]
    [InlineData("not-a-guid")]
    [InlineData("550e8400-e29b-41d4-a716")]
    public void IsValidGuid_WithInvalidUuid_Fails(string guid)
    {
        var validator = new GuidTestValidator();
        var result = validator.Validate(new StringTestModel(guid));
        result.IsValid.Should().BeFalse();
    }

    /// <summary>
    /// Tests that Guid.Empty fails validation (non-empty constraint).
    /// </summary>
    [Fact]
    public void IsValidGuid_WithEmptyGuid_Fails()
    {
        var validator = new GuidTestValidator();
        var result = validator.Validate(new StringTestModel(Guid.Empty.ToString()));
        result.IsValid.Should().BeFalse();
    }

    #endregion

    #region IsValidEmail

    /// <summary>
    /// Tests that valid emails pass validation.
    /// </summary>
    /// <param name="email">The email address to validate.</param>
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("test+tag@domain.org")]
    [InlineData("a@b.co")]
    public void IsValidEmail_WithValidEmail_Passes(string email)
    {
        var validator = new EmailTestValidator();
        var result = validator.Validate(new StringTestModel(email));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that invalid emails fail validation.
    /// </summary>
    /// <param name="email">The invalid email address to validate.</param>
    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("@domain.com")]
    [InlineData("user@")]
    public void IsValidEmail_WithInvalidEmail_Fails(string email)
    {
        var validator = new EmailTestValidator();
        var result = validator.Validate(new StringTestModel(email));
        result.IsValid.Should().BeFalse();
    }

    #endregion

    #region IsValidPhoneE164

    /// <summary>
    /// Tests that valid E.164 phone numbers pass validation.
    /// </summary>
    /// <param name="phone">The phone number to validate.</param>
    [Theory]
    [InlineData("1234567")]
    [InlineData("123456789012345")]
    [InlineData("15551234567")]
    public void IsValidPhoneE164_WithValidPhone_Passes(string phone)
    {
        var validator = new PhoneTestValidator();
        var result = validator.Validate(new StringTestModel(phone));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that invalid phone numbers fail validation.
    /// </summary>
    /// <param name="phone">The invalid phone number to validate.</param>
    [Theory]
    [InlineData("")]
    [InlineData("123456")]
    [InlineData("1234567890123456")]
    [InlineData("+1234567")]
    [InlineData("123-456-7890")]
    public void IsValidPhoneE164_WithInvalidPhone_Fails(string phone)
    {
        var validator = new PhoneTestValidator();
        var result = validator.Validate(new StringTestModel(phone));
        result.IsValid.Should().BeFalse();
    }

    #endregion

    #region IsNonEmpty (List)

    /// <summary>
    /// Tests that non-empty lists pass validation.
    /// </summary>
    [Fact]
    public void IsNonEmpty_WithNonEmptyList_Passes()
    {
        var validator = new ListTestValidator();
        var result = validator.Validate(new ListTestModel(["item"]));
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that empty lists fail validation.
    /// </summary>
    [Fact]
    public void IsNonEmpty_WithEmptyList_Fails()
    {
        var validator = new ListTestValidator();
        var result = validator.Validate(new ListTestModel([]));
        result.IsValid.Should().BeFalse();
    }

    #endregion

    #region Test Models & Validators

    private record IpTestModel(string IpAddress);

    private record StringTestModel(string Value);

    private record ListTestModel(List<string> Items);

    private class IpAddressTestValidator : AbstractValidator<IpTestModel>
    {
        public IpAddressTestValidator()
        {
            RuleFor(x => x.IpAddress).IsValidIpAddress();
        }
    }

    private class HashIdTestValidator : AbstractValidator<StringTestModel>
    {
        public HashIdTestValidator()
        {
            RuleFor(x => x.Value).IsValidHashId();
        }
    }

    private class GuidTestValidator : AbstractValidator<StringTestModel>
    {
        public GuidTestValidator()
        {
            RuleFor(x => x.Value).IsValidGuid();
        }
    }

    private class EmailTestValidator : AbstractValidator<StringTestModel>
    {
        public EmailTestValidator()
        {
            RuleFor(x => x.Value).IsValidEmail();
        }
    }

    private class PhoneTestValidator : AbstractValidator<StringTestModel>
    {
        public PhoneTestValidator()
        {
            RuleFor(x => x.Value).IsValidPhoneE164();
        }
    }

    private class ListTestValidator : AbstractValidator<ListTestModel>
    {
        public ListTestValidator()
        {
            RuleFor(x => x.Items).IsNonEmpty();
        }
    }

    #endregion
}
