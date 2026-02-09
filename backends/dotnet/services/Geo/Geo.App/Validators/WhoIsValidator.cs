// -----------------------------------------------------------------------
// <copyright file="WhoIsValidator.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Validators;

using D2.Geo.Domain.Entities;
using D2.Shared.Handler;
using FluentValidation;

/// <summary>
/// Aggregate validator for <see cref="WhoIs"/> domain entities.
/// Mirrors every constraint enforced by the <see cref="WhoIs"/> factory
/// and ComputeHashAndNormalizeIp methods.
/// </summary>
/// <remarks>
/// All rules must be at least as strict as the domain factories. If Fluent passes,
/// domain construction must never throw.
/// </remarks>
public class WhoIsValidator : AbstractValidator<WhoIs>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="WhoIsValidator"/> class.
    /// </summary>
    ///
    /// <param name="indexPrefix">
    /// Optional prefix for property names in bulk operations (e.g. "items[0].").
    /// </param>
    public WhoIsValidator(string indexPrefix = "")
    {
        // IPAddress: required, valid IP, max 45 chars.
        RuleFor(w => w.IPAddress)
            .NotEmpty()
            .OverridePropertyName($"{indexPrefix}ipAddress")
            .WithMessage("IP address is required.")
            .MaximumLength(45)
            .OverridePropertyName($"{indexPrefix}ipAddress")
            .IsValidIpAddress()
            .OverridePropertyName($"{indexPrefix}ipAddress");

        // Month: 1-12.
        RuleFor(w => w.Month)
            .InclusiveBetween(1, 12)
            .OverridePropertyName($"{indexPrefix}month")
            .WithMessage("Must be between 1 and 12.");

        // Year: 1-9999.
        RuleFor(w => w.Year)
            .InclusiveBetween(1, 9999)
            .OverridePropertyName($"{indexPrefix}year")
            .WithMessage("Must be between 1 and 9999.");

        // Fingerprint: max 2048 (optional).
        RuleFor(w => w.Fingerprint)
            .MaximumLength(2048)
            .When(w => w.Fingerprint is not null)
            .OverridePropertyName($"{indexPrefix}fingerprint");

        // HashId: 64-char hex (if already computed).
        RuleFor(w => w.HashId)
            .IsValidHashId()
            .When(w => !string.IsNullOrEmpty(w.HashId))
            .OverridePropertyName($"{indexPrefix}hashId");
    }
}
