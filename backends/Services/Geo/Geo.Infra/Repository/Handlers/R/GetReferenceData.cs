// -----------------------------------------------------------------------
// <copyright file="GetReferenceData.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.R;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Services.Protos.Geo.V1;
using Microsoft.EntityFrameworkCore;
using H = global::D2.Geo.App.Interfaces.Repository.R.IGeoReadRepo.IGetReferenceDataHandler;
using I = global::D2.Geo.App.Interfaces.Repository.R.IGeoReadRepo.GetReferenceDataInput;
using O = global::D2.Geo.App.Interfaces.Repository.R.IGeoReadRepo.GetReferenceDataOutput;

/// <summary>
/// Handler for getting all geographic reference data.
/// </summary>
public class GetReferenceData : BaseHandler<GetReferenceData, I, O>, H
{
    private readonly GeoDbContext r_db;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetReferenceData"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The geographic database context.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetReferenceData(
        GeoDbContext db,
        IHandlerContext context)
        : base(context)
    {
        r_db = db;
    }

    /// <summary>
    /// Executes the handler to get geographic reference data.
    /// </summary>
    ///
    /// <param name="input">
    /// The input parameters for the handler.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A task that represents the asynchronous operation, containing the result of the handler
    /// execution.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var countries = await r_db.Countries
            .AsNoTracking()
            .Include(c => c.Subdivisions)
            .Include(c => c.Currencies)
            .Include(c => c.Locales)
            .Include(c => c.GeopoliticalEntities)
            .Select(c => new CountryDTO
            {
                Iso31661Alpha2Code = c.ISO31661Alpha2Code,
                Iso31661Alpha3Code = c.ISO31661Alpha3Code,
                Iso31661NumericCode = c.ISO31661NumericCode,
                DisplayName = c.DisplayName,
                OfficialName = c.OfficialName,
                PhoneNumberPrefix = c.PhoneNumberPrefix,
                PhoneNumberFormat = c.PhoneNumberFormat,
                SovereignIso31661Alpha2Code = c.SovereignISO31661Alpha2Code ?? string.Empty,
                PrimaryCurrencyIso4217AlphaCode = c.PrimaryCurrencyISO4217AlphaCode ?? string.Empty,
                PrimaryLocaleIetfBcp47Tag = c.PrimaryLocaleIETFBCP47Tag ?? string.Empty,
                SubdivisionIso31662Codes = { c.Subdivisions.Select(s => s.ISO31662Code) },
                CurrencyIso4217AlphaCodes = { c.Currencies.Select(cur => cur.ISO4217AlphaCode) },
                LocaleIetfBcp47Tags = { c.Locales.Select(l => l.IETFBCP47Tag) },
                GeopoliticalEntityShortCodes = { c.GeopoliticalEntities.Select(g => g.ShortCode) },
            })
            .ToDictionaryAsync(c => c.Iso31661Alpha2Code, ct);

        var subdivisions = await r_db.Subdivisions
            .AsNoTracking()
            .Select(s => new SubdivisionDTO
            {
                Iso31662Code = s.ISO31662Code,
                ShortCode = s.ShortCode,
                DisplayName = s.DisplayName,
                OfficialName = s.OfficialName,
                CountryIso31661Alpha2Code = s.CountryISO31661Alpha2Code,
            })
            .ToDictionaryAsync(s => s.Iso31662Code, ct);

        var currencies = await r_db.Currencies
            .AsNoTracking()
            .Select(c => new CurrencyDTO
            {
                Iso4217AlphaCode = c.ISO4217AlphaCode,
                Iso4217NumericCode = c.ISO4217NumericCode,
                DisplayName = c.DisplayName,
                OfficialName = c.OfficialName,
                DecimalPlaces = c.DecimalPlaces,
                Symbol = c.Symbol,
            })
            .ToDictionaryAsync(c => c.Iso4217AlphaCode, ct);

        foreach (var country in countries.Values)
        {
            foreach (var currencyCode in country.CurrencyIso4217AlphaCodes)
            {
                if (currencies.TryGetValue(currencyCode, out var currency))
                {
                    currency.CountryIso31661Alpha2Codes.Add(country.Iso31661Alpha2Code);
                }
            }
        }

        var languages = await r_db.Languages
            .AsNoTracking()
            .Select(l => new LanguageDTO
            {
                Iso6391Code = l.ISO6391Code,
                Name = l.Name,
                Endonym = l.Endonym,
            })
            .ToDictionaryAsync(l => l.Iso6391Code, ct);

        var locales = await r_db.Locales
            .AsNoTracking()
            .Select(l => new LocaleDTO
            {
                IetfBcp47Tag = l.IETFBCP47Tag,
                Name = l.Name,
                Endonym = l.Endonym,
                LanguageIso6391Code = l.LanguageISO6391Code,
                CountryIso31661Alpha2Code = l.CountryISO31661Alpha2Code,
            })
            .ToDictionaryAsync(l => l.IetfBcp47Tag, ct);

        var geopoliticalEntities = await r_db.GeopoliticalEntities
            .AsNoTracking()
            .Include(g => g.Countries)
            .Select(g => new GeopoliticalEntityDTO
            {
                ShortCode = g.ShortCode,
                Name = g.Name,
                Type = g.Type.ToString(),
                CountryIso31661Alpha2Codes = { g.Countries.Select(c => c.ISO31661Alpha2Code) },
            })
            .ToDictionaryAsync(g => g.ShortCode, ct);

        var response = new GetReferenceDataResponse
        {
            Version = "1.0.0", // TODO: Determine versioning strategy
            UpdatedAt = Google.Protobuf.WellKnownTypes.Timestamp.FromDateTime(DateTime.UtcNow),
            Countries = { countries },
            Subdivisions = { subdivisions },
            Currencies = { currencies },
            Languages = { languages },
            Locales = { locales },
            GeopoliticalEntities = { geopoliticalEntities },
        };

        return D2Result<O?>.Ok(new O(response), traceId: TraceId);
    }
}
