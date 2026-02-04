// -----------------------------------------------------------------------
// <copyright file="GetRefDataResSerializationTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit;

using System.Text.Json;
using D2.Services.Protos.Geo.V1;
using Google.Protobuf;

/// <summary>
/// Tests for serialization and deserialization of GeoRefData.
/// </summary>
public class GetRefDataResSerializationTests
{
    /// <summary>
    /// Tests that GeoRefData serializes/deserializes using the same logic as Redis
    /// handlers.
    /// </summary>
    [Fact]
    public void GeoRefData_Serializes_And_Deserializes_Like_RedisHandler()
    {
        // Arrange
        var original = TestHelpers.TestGeoRefData;

        // Act - Serialize using handler logic
        var bytes = original is IMessage message
            ? message.ToByteArray()
            : JsonSerializer.SerializeToUtf8Bytes(original);

        // Act - Deserialize using handler logic (with reflection)
        var deserialized = typeof(GeoRefData).IsAssignableTo(typeof(IMessage))
            ? ParseProtobuf<GeoRefData>(bytes)
            : JsonSerializer.Deserialize<GeoRefData>(bytes);

        // Assert
        Assert.NotNull(deserialized);
        Assert.Equal(original.Version, deserialized.Version);
        Assert.Equal(original.UpdatedAt, deserialized.UpdatedAt);
        Assert.Single(deserialized.Countries);
        Assert.Equal("United States", deserialized.Countries["US"].DisplayName);
        Assert.Single(deserialized.Subdivisions);
        Assert.Equal("Alabama", deserialized.Subdivisions["US-AL"].DisplayName);
        Assert.Single(deserialized.Currencies);
        Assert.Equal("$", deserialized.Currencies["USD"].Symbol);
        Assert.Single(deserialized.Languages);
        Assert.Single(deserialized.Locales);
        Assert.Single(deserialized.GeopoliticalEntities);
    }

    private static TValue ParseProtobuf<TValue>(byte[] bytes)
    {
        var parser = typeof(TValue).GetProperty(
                "Parser",
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)!
            .GetValue(null)!;

        return (TValue)parser.GetType()
            .GetMethod("ParseFrom", [typeof(byte[])])!
            .Invoke(parser, [bytes])!;
    }
}
