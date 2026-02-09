// -----------------------------------------------------------------------
// <copyright file="LocationValidator.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Validators;

using D2.Geo.Domain.Entities;
using FluentValidation;

/// <summary>
/// Aggregate validator for <see cref="Location"/> domain entities.
/// Mirrors every constraint enforced by domain factories
/// (<see cref="Location"/>,
/// <see cref="Domain.ValueObjects.Coordinates"/>,
/// <see cref="Domain.ValueObjects.StreetAddress"/>).
/// </summary>
/// <remarks>
/// <para>
/// Location.Create itself never throws, but nested value objects
/// (<see cref="Domain.ValueObjects.Coordinates"/>, <see cref="Domain.ValueObjects.StreetAddress"/>)
/// do. This validator covers those constraints plus DB max-length limits.
/// </para>
/// <para>
/// All rules must be at least as strict as the domain factories. If Fluent passes,
/// domain construction must never throw.
/// </para>
/// </remarks>
public class LocationValidator : AbstractValidator<Location>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="LocationValidator"/> class.
    /// </summary>
    ///
    /// <param name="indexPrefix">
    /// Optional prefix for property names in bulk operations (e.g. "items[0].").
    /// </param>
    public LocationValidator(string indexPrefix = "")
    {
        // Coordinates (if present).
        When(l => l.Coordinates is not null, () =>
        {
            RuleFor(l => l.Coordinates!.Latitude)
                .InclusiveBetween(-90, 90)
                .OverridePropertyName($"{indexPrefix}latitude")
                .WithMessage("Must be between -90 and 90.");

            RuleFor(l => l.Coordinates!.Longitude)
                .InclusiveBetween(-180, 180)
                .OverridePropertyName($"{indexPrefix}longitude")
                .WithMessage("Must be between -180 and 180.");
        });

        // Address (if present).
        When(l => l.Address is not null, () =>
        {
            RuleFor(l => l.Address!.Line1)
                .NotEmpty()
                .OverridePropertyName($"{indexPrefix}address.line1")
                .WithMessage("Line1 is required when address is provided.")
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}address.line1");

            RuleFor(l => l.Address!.Line2)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}address.line2");

            RuleFor(l => l.Address!.Line3)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}address.line3");

            // Line3 requires Line2.
            RuleFor(l => l.Address!.Line2)
                .NotEmpty()
                .When(l => !string.IsNullOrWhiteSpace(l.Address!.Line3))
                .OverridePropertyName($"{indexPrefix}address.line2")
                .WithMessage("Line2 is required when Line3 is provided.");
        });

        // City (DB max 255).
        RuleFor(l => l.City)
            .MaximumLength(255)
            .When(l => l.City is not null)
            .OverridePropertyName($"{indexPrefix}city");

        // PostalCode (DB max 16).
        RuleFor(l => l.PostalCode)
            .MaximumLength(16)
            .When(l => l.PostalCode is not null)
            .OverridePropertyName($"{indexPrefix}postalCode");

        // SubdivisionISO31662Code (DB max 6).
        RuleFor(l => l.SubdivisionISO31662Code)
            .MaximumLength(6)
            .When(l => l.SubdivisionISO31662Code is not null)
            .OverridePropertyName($"{indexPrefix}subdivisionCode");

        // CountryISO31661Alpha2Code (DB max 2).
        RuleFor(l => l.CountryISO31661Alpha2Code)
            .MaximumLength(2)
            .When(l => l.CountryISO31661Alpha2Code is not null)
            .OverridePropertyName($"{indexPrefix}countryCode");
    }
}
