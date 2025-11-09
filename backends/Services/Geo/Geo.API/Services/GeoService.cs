using D2.Services.Protos.Geo.V1;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using ServiceBase = D2.Services.Protos.Geo.V1.GeoService.GeoServiceBase;

namespace Geo.API.Services;

public class GeoService : ServiceBase
{
    public override Task<GetReferenceDataResponse> GetReferenceData(
        GetReferenceDataRequest request,
        ServerCallContext context)
    {
        // Dummy implementation for demonstration purposes
        var response = new GetReferenceDataResponse()
        {
            Version = "0.0.0",
            UpdatedAt = Timestamp.FromDateTime(DateTime.UtcNow),
            Countries =
            {
                { "US", new CountryDTO {
                    Iso31661Alpha2Code = "US",
                    Iso31661Alpha3Code = "USA",
                    Iso31661NumericCode = "840",
                    DisplayName = "United States",
                    OfficialName = "United States of America",
                    PhoneNumberPrefix = "1",
                    PhoneNumberFormat = "(###) ###-####",
                    PrimaryCurrencyIso4217AlphaCode = "USD",
                    PrimaryLocaleIetfBcp47Tag = "en-US",
                    SubdivisionIso31662Codes =
                    {
                        "US-AL",
                        "US-AK",
                        "US-AZ"
                    },
                    LocaleIetfBcp47Tags =
                    {
                        "en-US",
                        "es-US"
                    },
                    GeopoliticalEntityShortCodes =
                    {
                        "NATO",
                        "UN",
                        "USMCA"
                    }
                }}
            },
            Subdivisions =
            {
                { "US-AL", new SubdivisionDTO {
                    Iso31662Code = "US-AL",
                    ShortCode = "AL",
                    DisplayName = "Alabama",
                    OfficialName = "State of Alabama",
                    CountryIso31661Alpha2Code = "US"
                }},
                { "US-AK", new SubdivisionDTO {
                    Iso31662Code = "US-AK",
                    ShortCode = "AK",
                    DisplayName = "Alaska",
                    OfficialName = "State of Alaska",
                    CountryIso31661Alpha2Code = "US"
                }},
                { "US-AZ", new SubdivisionDTO {
                    Iso31662Code = "US-AZ",
                    ShortCode = "AZ",
                    DisplayName = "Arizona",
                    OfficialName = "State of Arizona",
                    CountryIso31661Alpha2Code = "US"
                }}
            },
            Currencies =
            {
                { "USD", new CurrencyDTO {
                    Iso4217AlphaCode = "USD",
                    Iso4217NumericCode = "840",
                    DisplayName = "US Dollar",
                    OfficialName = "United States Dollar",
                    DecimalPlaces = 2,
                    Symbol = "$",
                }}
            },
            Languages =
            {
                { "en", new LanguageDTO {
                    Iso6391Code = "en",
                    Name = "English",
                    Endonym = "English"
                }},
                { "es", new LanguageDTO {
                    Iso6391Code = "es",
                    Name = "Spanish",
                    Endonym = "Español"
                }},
            },
            Locales =
            {
                { "en-US", new LocaleDTO {
                    IetfBcp47Tag = "en-US",
                    Name = "English (United States)",
                    Endonym = "English (United States)",
                    LanguageIso6391Code = "en",
                    CountryIso31661Alpha2Code = "US"
                }},
                { "es-US", new LocaleDTO {
                    IetfBcp47Tag = "es-US",
                    Name = "Spanish (United States)",
                    Endonym = "Español (Estados Unidos)",
                    LanguageIso6391Code = "es",
                    CountryIso31661Alpha2Code = "US"
                } }
            },
            GeopoliticalEntities =
            {
                { "NATO", new GeopoliticalEntityDTO {
                    ShortCode = "NATO",
                    Name = "North Atlantic Treaty Organization",
                    Type = "MilitaryAlliance",
                    CountryIso31661Alpha2Codes =
                    {
                        "US",
                    }
                }},
                { "UN", new GeopoliticalEntityDTO {
                    ShortCode = "UN",
                    Name = "United Nations",
                    Type = "InternationalOrganization",
                    CountryIso31661Alpha2Codes =
                    {
                        "US",
                    }
                }},
                { "USMCA", new GeopoliticalEntityDTO {
                    ShortCode = "USMCA",
                    Name = "United States-Mexico-Canada Agreement",
                    Type = "FreeTradeAgreement",
                    CountryIso31661Alpha2Codes =
                    {
                        "US",
                    }
                }}
            }
        };

        return Task.FromResult(response);
    }
}
