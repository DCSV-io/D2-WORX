// -----------------------------------------------------------------------
// <copyright file="StreetAddressMapper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Mappers;

using D2.Geo.Domain.ValueObjects;
using D2.Services.Protos.Geo.V1;

/// <summary>
/// Mapper for converting between <see cref="StreetAddress"/> and <see cref="StreetAddressDTO"/>.
/// </summary>
public static class StreetAddressMapper
{
    /// <summary>
    /// Maps <see cref="StreetAddress"/> to <see cref="StreetAddressDTO"/>.
    /// </summary>
    ///
    /// <param name="streetAddress">
    /// The domain object to be mapped to a DTO.
    /// </param>
    extension(StreetAddress streetAddress)
    {
        /// <summary>
        /// Converts the <see cref="StreetAddress"/> domain object to a <see cref="StreetAddressDTO"/>.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="StreetAddressDTO"/> object.
        /// </returns>
        public StreetAddressDTO ToDTO()
        {
            return new StreetAddressDTO
            {
                Line1 = streetAddress.Line1,
                Line2 = streetAddress.Line2 ?? string.Empty,
                Line3 = streetAddress.Line3 ?? string.Empty,
            };
        }
    }

    /// <summary>
    /// Maps <see cref="StreetAddressDTO"/> to <see cref="StreetAddress"/>.
    /// </summary>
    ///
    /// <param name="streetAddressDTO">
    /// The DTO to be mapped to a domain object.
    /// </param>
    extension(StreetAddressDTO streetAddressDTO)
    {
        /// <summary>
        /// Converts the <see cref="StreetAddressDTO"/> to a <see cref="StreetAddress"/> domain object.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="StreetAddress"/> domain object.
        /// </returns>
        public StreetAddress ToDomain()
        {
            return StreetAddress.Create(
                streetAddressDTO.Line1,
                streetAddressDTO.Line2,
                streetAddressDTO.Line3);
        }
    }
}
