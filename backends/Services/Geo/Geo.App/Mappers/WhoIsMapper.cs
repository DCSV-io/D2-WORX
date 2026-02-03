// -----------------------------------------------------------------------
// <copyright file="WhoIsMapper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Mappers;

using D2.Contracts.Utilities.Extensions;
using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;

/// <summary>
/// Mapper for converting between <see cref="WhoIs"/> and <see cref="WhoIsDTO"/>.
/// </summary>
public static class WhoIsMapper
{
    /// <summary>
    /// Maps <see cref="WhoIs"/> to <see cref="WhoIsDTO"/>.
    /// </summary>
    ///
    /// <param name="whoIs">
    /// The domain object to be mapped to a DTO.
    /// </param>
    extension(WhoIs whoIs)
    {
        /// <summary>
        /// Converts the <see cref="WhoIs"/> domain object to a <see cref="WhoIsDTO"/>.
        /// </summary>
        ///
        /// <param name="location">
        /// Optional location entity to include in the DTO.
        /// </param>
        ///
        /// <returns>
        /// The mapped <see cref="WhoIsDTO"/> object.
        /// </returns>
        public WhoIsDTO ToDTO(Location? location = null)
        {
            return new WhoIsDTO
            {
                HashId = whoIs.HashId,
                IpAddress = whoIs.IPAddress,
                Year = whoIs.Year,
                Month = whoIs.Month,
                Fingerprint = whoIs.Fingerprint ?? string.Empty,
                Asn = whoIs.ASN ?? 0,
                AsName = whoIs.ASName ?? string.Empty,
                AsDomain = whoIs.ASDomain ?? string.Empty,
                AsType = whoIs.ASType ?? string.Empty,
                CarrierName = whoIs.CarrierName ?? string.Empty,
                Mcc = whoIs.MCC ?? string.Empty,
                Mnc = whoIs.MNC ?? string.Empty,
                AsChanged = whoIs.ASChanged?.ToString("O") ?? string.Empty,
                GeoChanged = whoIs.GeoChanged?.ToString("O") ?? string.Empty,
                IsAnonymous = whoIs.IsAnonymous ?? false,
                IsAnycast = whoIs.IsAnycast ?? false,
                IsHosting = whoIs.IsHosting ?? false,
                IsMobile = whoIs.IsMobile ?? false,
                IsSatellite = whoIs.IsSatellite ?? false,
                IsProxy = whoIs.IsProxy ?? false,
                IsRelay = whoIs.IsRelay ?? false,
                IsTor = whoIs.IsTor ?? false,
                IsVpn = whoIs.IsVPN ?? false,
                PrivacyName = whoIs.PrivacyName ?? string.Empty,
                Location = location?.ToDTO(),
            };
        }
    }

    /// <summary>
    /// Maps <see cref="WhoIsDTO"/> to <see cref="WhoIs"/>.
    /// </summary>
    ///
    /// <param name="whoIsDTO">
    /// The DTO to be mapped to a domain object.
    /// </param>
    extension(WhoIsDTO whoIsDTO)
    {
        /// <summary>
        /// Converts the <see cref="WhoIsDTO"/> to a <see cref="WhoIs"/> domain object.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="WhoIs"/> domain object.
        /// </returns>
        public WhoIs ToDomain()
        {
            return WhoIs.Create(
                whoIsDTO.IpAddress,
                whoIsDTO.Year,
                whoIsDTO.Month,
                whoIsDTO.Fingerprint.Falsey() ? null : whoIsDTO.Fingerprint,
                whoIsDTO.Asn == 0 ? null : whoIsDTO.Asn,
                whoIsDTO.AsName.Falsey() ? null : whoIsDTO.AsName,
                whoIsDTO.AsDomain.Falsey() ? null : whoIsDTO.AsDomain,
                whoIsDTO.AsType.Falsey() ? null : whoIsDTO.AsType,
                whoIsDTO.CarrierName.Falsey() ? null : whoIsDTO.CarrierName,
                whoIsDTO.Mcc.Falsey() ? null : whoIsDTO.Mcc,
                whoIsDTO.Mnc.Falsey() ? null : whoIsDTO.Mnc,
                DateOnly.TryParse(whoIsDTO.AsChanged, out var asChanged) ? asChanged : null,
                DateOnly.TryParse(whoIsDTO.GeoChanged, out var geoChanged) ? geoChanged : null,
                whoIsDTO.IsAnonymous,
                whoIsDTO.IsAnycast,
                whoIsDTO.IsHosting,
                whoIsDTO.IsMobile,
                whoIsDTO.IsSatellite,
                whoIsDTO.IsProxy,
                whoIsDTO.IsRelay,
                whoIsDTO.IsTor,
                whoIsDTO.IsVpn,
                whoIsDTO.PrivacyName.Falsey() ? null : whoIsDTO.PrivacyName,
                whoIsDTO.Location?.HashId.Falsey() != false ? null : whoIsDTO.Location.HashId);
        }
    }
}
