// -----------------------------------------------------------------------
// <copyright file="ContactToCreateValidator.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Validators;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using FluentValidation;

/// <summary>
/// Aggregate validator for <see cref="ContactToCreateDTO"/> proto messages.
/// Mirrors every constraint enforced by domain factories
/// (<see cref="Domain.Entities.Contact"/>,
/// <see cref="Domain.ValueObjects.Personal"/>,
/// <see cref="Domain.ValueObjects.Professional"/>,
/// <see cref="Domain.ValueObjects.EmailAddress"/>,
/// <see cref="Domain.ValueObjects.PhoneNumber"/>).
/// </summary>
/// <remarks>
/// All rules must be at least as strict as the domain factories. If Fluent passes,
/// domain construction must never throw.
/// </remarks>
public class ContactToCreateValidator : AbstractValidator<ContactToCreateDTO>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ContactToCreateValidator"/> class.
    /// </summary>
    ///
    /// <param name="indexPrefix">
    /// Optional prefix for property names in bulk operations (e.g. "items[0].").
    /// </param>
    public ContactToCreateValidator(string indexPrefix = "")
    {
        // ContextKey: required, max 255.
        RuleFor(c => c.ContextKey)
            .NotEmpty()
            .OverridePropertyName($"{indexPrefix}contextKey")
            .WithMessage("Context key is required.")
            .MaximumLength(255)
            .OverridePropertyName($"{indexPrefix}contextKey");

        // RelatedEntityId: required, valid non-empty GUID.
        RuleFor(c => c.RelatedEntityId)
            .NotEmpty()
            .OverridePropertyName($"{indexPrefix}relatedEntityId")
            .WithMessage("Related entity ID is required.")
            .IsValidGuid()
            .OverridePropertyName($"{indexPrefix}relatedEntityId");

        // Personal details (if present).
        When(c => c.PersonalDetails is not null, () =>
        {
            RuleFor(c => c.PersonalDetails.FirstName)
                .NotEmpty()
                .OverridePropertyName($"{indexPrefix}personalDetails.firstName")
                .WithMessage("First name is required when personal details are provided.")
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}personalDetails.firstName");

            RuleFor(c => c.PersonalDetails.PreferredName)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}personalDetails.preferredName");

            RuleFor(c => c.PersonalDetails.MiddleName)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}personalDetails.middleName");

            RuleFor(c => c.PersonalDetails.LastName)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}personalDetails.lastName");
        });

        // Professional details (if present).
        When(c => c.ProfessionalDetails is not null, () =>
        {
            RuleFor(c => c.ProfessionalDetails.CompanyName)
                .NotEmpty()
                .OverridePropertyName($"{indexPrefix}professionalDetails.companyName")
                .WithMessage("Company name is required when professional details are provided.")
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}professionalDetails.companyName");

            RuleFor(c => c.ProfessionalDetails.JobTitle)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}professionalDetails.jobTitle");

            RuleFor(c => c.ProfessionalDetails.Department)
                .MaximumLength(255)
                .OverridePropertyName($"{indexPrefix}professionalDetails.department");

            RuleFor(c => c.ProfessionalDetails.CompanyWebsite)
                .MaximumLength(2048)
                .OverridePropertyName($"{indexPrefix}professionalDetails.companyWebsite");
        });

        // Contact methods — emails (if present).
        When(c => c.ContactMethods is not null && c.ContactMethods.Emails.Count > 0, () =>
        {
            RuleForEach(c => c.ContactMethods.Emails)
                .ChildRules(email =>
                {
                    email.RuleFor(e => e.Value)
                        .NotEmpty()
                        .WithMessage("Email address is required.")
                        .IsValidEmail();
                })
                .OverridePropertyName($"{indexPrefix}contactMethods.emails");
        });

        // Contact methods — phone numbers (if present).
        When(c => c.ContactMethods is not null && c.ContactMethods.PhoneNumbers.Count > 0, () =>
        {
            RuleForEach(c => c.ContactMethods.PhoneNumbers)
                .ChildRules(phone =>
                {
                    phone.RuleFor(p => p.Value)
                        .NotEmpty()
                        .WithMessage("Phone number is required.")
                        .IsValidPhoneE164();
                })
                .OverridePropertyName($"{indexPrefix}contactMethods.phoneNumbers");
        });
    }
}
