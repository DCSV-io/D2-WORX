// -----------------------------------------------------------------------
// <copyright file="LocationMapper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Mappers;

using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;

/// <summary>
/// Mapper for converting between <see cref="Location"/> and <see cref="LocationDTO"/>.
/// </summary>
public static class LocationMapper
{
    /// <summary>
    /// Maps <see cref="Location"/> to <see cref="LocationDTO"/>.
    /// </summary>
    ///
    /// <param name="location">
    /// The domain object to be mapped to a DTO.
    /// </param>
    extension(Location location)
    {
        /// <summary>
        /// Converts the <see cref="Location"/> domain object to a <see cref="LocationDTO"/>.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="LocationDTO"/> object.
        /// </returns>
        public LocationDTO ToDTO()
        {
            return new LocationDTO
            {
                HashId = location.HashId,
                Coordinates = location.Coordinates?.ToDTO(),
                Address = location.Address?.ToDTO(),
                City = location.City ?? string.Empty,
                PostalCode = location.PostalCode ?? string.Empty,
                SubdivisionIso31662Code = location.SubdivisionISO31662Code ?? string.Empty,
                CountryIso31661Alpha2Code = location.CountryISO31661Alpha2Code ?? string.Empty,
            };
        }
    }

    /// <summary>
    /// Maps <see cref="LocationDTO"/> to <see cref="Location"/>.
    /// </summary>
    ///
    /// <param name="locationDTO">
    /// The DTO to be mapped to a domain object.
    /// </param>
    extension(LocationDTO locationDTO)
    {
        /// <summary>
        /// Converts the <see cref="LocationDTO"/> to a <see cref="Location"/> domain object.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="Location"/> domain object.
        /// </returns>
        public Location ToDomain()
        {
            return Location.Create(
                locationDTO.Coordinates?.ToDomain(),
                locationDTO.Address?.ToDomain(),
                locationDTO.City,
                locationDTO.PostalCode,
                locationDTO.SubdivisionIso31662Code,
                locationDTO.CountryIso31661Alpha2Code);
        }
    }

    /// <summary>
    /// Maps <see cref="LocationToCreateDTO"/> to <see cref="Location"/>.
    /// </summary>
    ///
    /// <param name="locationToCreateDTO">
    /// The DTO to be mapped to a domain object.
    /// </param>
    extension(LocationToCreateDTO locationToCreateDTO)
    {
        /// <summary>
        /// Converts the <see cref="LocationToCreateDTO"/> to a <see cref="Location"/> domain object.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="Location"/> domain object.
        /// </returns>
        public Location ToDomain()
        {
            return Location.Create(
                locationToCreateDTO.Coordinates?.ToDomain(),
                locationToCreateDTO.Address?.ToDomain(),
                locationToCreateDTO.City,
                locationToCreateDTO.PostalCode,
                locationToCreateDTO.SubdivisionIso31662Code,
                locationToCreateDTO.CountryIso31661Alpha2Code);
        }
    }
}
