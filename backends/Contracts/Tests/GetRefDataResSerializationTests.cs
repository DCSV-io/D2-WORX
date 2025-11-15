// -----------------------------------------------------------------------
// <copyright file="GetRefDataResSerializationTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Tests;

using System.Text.Json;
using D2.Services.Protos.Geo.V1;
using Google.Protobuf;
using Google.Protobuf.WellKnownTypes;

/// <summary>
/// Tests for serialization and deserialization of GetReferenceDataResponse.
/// </summary>
public class GetRefDataResSerializationTests
{
    /// <summary>
    /// Tests that GetReferenceDataResponse serializes/deserializes using the same logic as Redis
    /// handlers.
    /// </summary>
    [Fact]
    public void GetReferenceDataResponse_Serializes_And_Deserializes_Like_RedisHandler()
    {
        // Arrange
        var original = new GetReferenceDataResponse
        {
            Version = "0.0.0",
            UpdatedAt = Timestamp.FromDateTime(DateTime.UtcNow),
            Countries =
            {
                {
                    "US", new CountryDTO
                    {
                        Iso31661Alpha2Code = "US",
                        Iso31661Alpha3Code = "USA",
                        Iso31661NumericCode = "840",
                        DisplayName = "United States",
                        OfficialName = "United States of America",
                        PhoneNumberPrefix = "1",
                        PhoneNumberFormat = "(###) ###-####",
                        PrimaryCurrencyIso4217AlphaCode = "USD",
                        PrimaryLocaleIetfBcp47Tag = "en-US",
                        SubdivisionIso31662Codes = { "US-AL", "US-AK", "US-AZ" },
                        LocaleIetfBcp47Tags = { "en-US", "es-US" },
                        GeopoliticalEntityShortCodes = { "NATO", "UN", "USMCA" },
                    }
                },
            },
            Subdivisions =
            {
                {
                    "US-AL", new SubdivisionDTO
                    {
                        Iso31662Code = "US-AL",
                        ShortCode = "AL",
                        DisplayName = "Alabama",
                        OfficialName = "State of Alabama",
                        CountryIso31661Alpha2Code = "US",
                    }
                },
            },
            Currencies =
            {
                {
                    "USD", new CurrencyDTO
                    {
                        Iso4217AlphaCode = "USD",
                        Iso4217NumericCode = "840",
                        DisplayName = "US Dollar",
                        OfficialName = "United States Dollar",
                        DecimalPlaces = 2,
                        Symbol = "$",
                    }
                },
            },
            Languages =
            {
                {
                    "en", new LanguageDTO
                    {
                        Iso6391Code = "en",
                        Name = "English",
                        Endonym = "English",
                    }
                },
            },
            Locales =
            {
                {
                    "en-US", new LocaleDTO
                    {
                        IetfBcp47Tag = "en-US",
                        Name = "English (United States)",
                        Endonym = "English (United States)",
                        LanguageIso6391Code = "en",
                        CountryIso31661Alpha2Code = "US",
                    }
                },
            },
            GeopoliticalEntities =
            {
                {
                    "NATO", new GeopoliticalEntityDTO
                    {
                        ShortCode = "NATO",
                        Name = "North Atlantic Treaty Organization",
                        Type = "MilitaryAlliance",
                        CountryIso31661Alpha2Codes = { "US" },
                    }
                },
            },
        };

        // Act - Serialize using handler logic
        var bytes = original is IMessage message
            ? message.ToByteArray()
            : JsonSerializer.SerializeToUtf8Bytes(original);

        // Act - Deserialize using handler logic (with reflection)
        var deserialized = typeof(GetReferenceDataResponse).IsAssignableTo(typeof(IMessage))
            ? ParseProtobuf<GetReferenceDataResponse>(bytes)
            : JsonSerializer.Deserialize<GetReferenceDataResponse>(bytes);

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
