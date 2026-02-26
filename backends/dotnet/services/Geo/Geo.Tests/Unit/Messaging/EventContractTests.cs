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
}
