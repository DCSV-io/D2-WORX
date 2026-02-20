// -----------------------------------------------------------------------
// <copyright file="EventContractTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.Messaging;

using D2.Events.Protos.V1;
using FluentAssertions;
using Google.Protobuf;
using Xunit;

/// <summary>
/// Contract tests that validate JSON fixtures can be deserialized into proto types
/// and survive a round-trip through <see cref="JsonFormatter"/> / <see cref="JsonParser"/>.
/// Both .NET and Node.js run these tests against the same fixtures to guarantee
/// cross-language compatibility.
/// </summary>
public class EventContractTests
{
    private static readonly string sr_fixturesDir = Path.Combine(
        AppContext.BaseDirectory,
        "Fixtures",
        "events",
        "v1");

    /// <summary>
    /// Tests that the GeoRefDataUpdatedEvent fixture deserializes correctly.
    /// </summary>
    [Fact]
    public void GeoRefDataUpdatedEvent_Fixture_DeserializesCorrectly()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "geo-ref-data-updated.json"));
        var parsed = JsonParser.Default.Parse<GeoRefDataUpdatedEvent>(json);

        parsed.Version.Should().Be("3.0.0");
    }

    /// <summary>
    /// Tests that the GeoRefDataUpdatedEvent survives a JSON round-trip.
    /// </summary>
    [Fact]
    public void GeoRefDataUpdatedEvent_Fixture_SurvivesRoundTrip()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "geo-ref-data-updated.json"));
        var parsed = JsonParser.Default.Parse<GeoRefDataUpdatedEvent>(json);

        var serialized = JsonFormatter.Default.Format(parsed);
        var reparsed = JsonParser.Default.Parse<GeoRefDataUpdatedEvent>(serialized);

        reparsed.Version.Should().Be(parsed.Version);
    }

    /// <summary>
    /// Tests that the SendVerificationEmailEvent fixture deserializes correctly.
    /// </summary>
    [Fact]
    public void SendVerificationEmailEvent_Fixture_DeserializesCorrectly()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "send-verification-email.json"));
        var parsed = JsonParser.Default.Parse<SendVerificationEmailEvent>(json);

        parsed.UserId.Should().Be("019500aa-bbcc-7def-8901-234567890abc");
        parsed.Email.Should().Be("test@example.com");
        parsed.Name.Should().Be("Test User");
        parsed.VerificationUrl.Should().Be("https://app.example.com/verify?token=abc123");
        parsed.Token.Should().Be("abc123");
    }

    /// <summary>
    /// Tests that the SendVerificationEmailEvent survives a JSON round-trip.
    /// </summary>
    [Fact]
    public void SendVerificationEmailEvent_Fixture_SurvivesRoundTrip()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "send-verification-email.json"));
        var parsed = JsonParser.Default.Parse<SendVerificationEmailEvent>(json);

        var serialized = JsonFormatter.Default.Format(parsed);
        var reparsed = JsonParser.Default.Parse<SendVerificationEmailEvent>(serialized);

        reparsed.UserId.Should().Be(parsed.UserId);
        reparsed.Email.Should().Be(parsed.Email);
        reparsed.Name.Should().Be(parsed.Name);
        reparsed.VerificationUrl.Should().Be(parsed.VerificationUrl);
        reparsed.Token.Should().Be(parsed.Token);
    }

    /// <summary>
    /// Tests that the SendPasswordResetEvent fixture deserializes correctly.
    /// </summary>
    [Fact]
    public void SendPasswordResetEvent_Fixture_DeserializesCorrectly()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "send-password-reset.json"));
        var parsed = JsonParser.Default.Parse<SendPasswordResetEvent>(json);

        parsed.UserId.Should().Be("019500aa-bbcc-7def-8901-234567890abc");
        parsed.Email.Should().Be("test@example.com");
        parsed.Name.Should().Be("Test User");
        parsed.ResetUrl.Should().Be("https://app.example.com/reset?token=def456");
        parsed.Token.Should().Be("def456");
    }

    /// <summary>
    /// Tests that the SendPasswordResetEvent survives a JSON round-trip.
    /// </summary>
    [Fact]
    public void SendPasswordResetEvent_Fixture_SurvivesRoundTrip()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "send-password-reset.json"));
        var parsed = JsonParser.Default.Parse<SendPasswordResetEvent>(json);

        var serialized = JsonFormatter.Default.Format(parsed);
        var reparsed = JsonParser.Default.Parse<SendPasswordResetEvent>(serialized);

        reparsed.UserId.Should().Be(parsed.UserId);
        reparsed.Email.Should().Be(parsed.Email);
        reparsed.Name.Should().Be(parsed.Name);
        reparsed.ResetUrl.Should().Be(parsed.ResetUrl);
        reparsed.Token.Should().Be(parsed.Token);
    }

    /// <summary>
    /// Tests that the SendInvitationEmailEvent fixture deserializes correctly.
    /// </summary>
    [Fact]
    public void SendInvitationEmailEvent_Fixture_DeserializesCorrectly()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "send-invitation-email.json"));
        var parsed = JsonParser.Default.Parse<SendInvitationEmailEvent>(json);

        parsed.InvitationId.Should().Be("019500bb-ccdd-7eef-0011-223344556677");
        parsed.InviteeEmail.Should().Be("invitee@example.com");
        parsed.OrganizationId.Should().Be("019500cc-ddee-7ff0-1122-334455667788");
        parsed.OrganizationName.Should().Be("Acme Corp");
        parsed.Role.Should().Be("member");
        parsed.InviterName.Should().Be("Admin User");
        parsed.InviterEmail.Should().Be("admin@example.com");
        parsed.InvitationUrl.Should().Be("https://app.example.com/invite/accept?token=ghi789");
    }

    /// <summary>
    /// Tests that the SendInvitationEmailEvent survives a JSON round-trip.
    /// </summary>
    [Fact]
    public void SendInvitationEmailEvent_Fixture_SurvivesRoundTrip()
    {
        var json = File.ReadAllText(Path.Combine(sr_fixturesDir, "send-invitation-email.json"));
        var parsed = JsonParser.Default.Parse<SendInvitationEmailEvent>(json);

        var serialized = JsonFormatter.Default.Format(parsed);
        var reparsed = JsonParser.Default.Parse<SendInvitationEmailEvent>(serialized);

        reparsed.InvitationId.Should().Be(parsed.InvitationId);
        reparsed.InviteeEmail.Should().Be(parsed.InviteeEmail);
        reparsed.OrganizationId.Should().Be(parsed.OrganizationId);
        reparsed.OrganizationName.Should().Be(parsed.OrganizationName);
        reparsed.Role.Should().Be(parsed.Role);
        reparsed.InviterName.Should().Be(parsed.InviterName);
        reparsed.InviterEmail.Should().Be(parsed.InviterEmail);
        reparsed.InvitationUrl.Should().Be(parsed.InvitationUrl);
    }
}
