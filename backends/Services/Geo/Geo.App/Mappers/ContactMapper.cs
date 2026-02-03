// -----------------------------------------------------------------------
// <copyright file="ContactMapper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Mappers;

using D2.Contracts.Utilities.Extensions;
using D2.Geo.Domain.Entities;
using D2.Services.Protos.Geo.V1;
using Google.Protobuf.WellKnownTypes;

/// <summary>
/// Mapper for converting between <see cref="Contact"/> and <see cref="ContactDTO"/>.
/// </summary>
public static class ContactMapper
{
    /// <summary>
    /// Maps <see cref="Contact"/> to <see cref="ContactDTO"/>.
    /// </summary>
    ///
    /// <param name="contact">
    /// The domain object to be mapped to a DTO.
    /// </param>
    extension(Contact contact)
    {
        /// <summary>
        /// Converts the <see cref="Contact"/> domain object to a <see cref="ContactDTO"/>.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="ContactDTO"/> object.
        /// </returns>
        public ContactDTO ToDTO()
        {
            return new ContactDTO
            {
                Id = contact.Id.ToString(),
                CreatedAt = Timestamp.FromDateTime(DateTime.SpecifyKind(contact.CreatedAt, DateTimeKind.Utc)),
                ContextKey = contact.ContextKey,
                RelatedEntityId = contact.RelatedEntityId.ToString(),
                ContactMethods = contact.ContactMethods?.ToDTO(),
                PersonalDetails = contact.PersonalDetails?.ToDTO(),
                ProfessionalDetails = contact.ProfessionalDetails?.ToDTO(),
                LocationHashId = contact.LocationHashId ?? string.Empty,
            };
        }
    }

    /// <summary>
    /// Maps <see cref="ContactDTO"/> to <see cref="Contact"/>.
    /// </summary>
    ///
    /// <param name="contactDTO">
    /// The DTO to be mapped to a domain object.
    /// </param>
    extension(ContactDTO contactDTO)
    {
        /// <summary>
        /// Converts the <see cref="ContactDTO"/> to a <see cref="Contact"/> domain object.
        /// </summary>
        ///
        /// <returns>
        /// The mapped <see cref="Contact"/> domain object.
        /// </returns>
        public Contact ToDomain()
        {
            return Contact.Create(
                contactDTO.ContextKey,
                Guid.Parse(contactDTO.RelatedEntityId),
                contactDTO.ContactMethods?.ToDomain(),
                contactDTO.PersonalDetails?.ToDomain(),
                contactDTO.ProfessionalDetails?.ToDomain(),
                contactDTO.LocationHashId.Falsey() ? null : contactDTO.LocationHashId);
        }
    }

    /// <summary>
    /// Maps <see cref="ContactToCreateDTO"/> to <see cref="Contact"/>.
    /// </summary>
    ///
    /// <param name="contactToCreateDTO">
    /// The DTO to be mapped to a domain object.
    /// </param>
    extension(ContactToCreateDTO contactToCreateDTO)
    {
        /// <summary>
        /// Converts the <see cref="ContactToCreateDTO"/> to a <see cref="Contact"/> domain object.
        /// </summary>
        ///
        /// <param name="locationHashId">
        /// The location hash ID to associate with the contact.
        /// </param>
        ///
        /// <returns>
        /// The mapped <see cref="Contact"/> domain object.
        /// </returns>
        public Contact ToDomain(string? locationHashId)
        {
            return Contact.Create(
                contactToCreateDTO.ContextKey,
                Guid.Parse(contactToCreateDTO.RelatedEntityId),
                contactToCreateDTO.ContactMethods?.ToDomain(),
                contactToCreateDTO.PersonalDetails?.ToDomain(),
                contactToCreateDTO.ProfessionalDetails?.ToDomain(),
                locationHashId);
        }

        /// <summary>
        /// Extracts the Location to create from embedded data, if present.
        /// </summary>
        ///
        /// <returns>
        /// The extracted <see cref="Location"/> or null if no location data is embedded.
        /// </returns>
        public Location? ExtractLocation()
        {
            var loc = contactToCreateDTO.LocationToCreate;
            if (loc is null)
            {
                return null;
            }

            // Check if truly empty (protobuf messages are never null, but may be empty).
            if (loc.City.Falsey() &&
                loc.PostalCode.Falsey() &&
                loc.SubdivisionIso31662Code.Falsey() &&
                loc.CountryIso31661Alpha2Code.Falsey() &&
                loc.Coordinates is null &&
                loc.Address is null)
            {
                return null;
            }

            return loc.ToDomain();
        }

        /// <summary>
        /// Gets the explicit location hash ID if provided.
        /// </summary>
        ///
        /// <returns>
        /// The explicit location hash ID or null if not provided or empty.
        /// </returns>
        public string? GetExplicitLocationHashId()
        {
            return contactToCreateDTO.LocationHashId.Falsey()
                ? null
                : contactToCreateDTO.LocationHashId;
        }
    }
}
