// -----------------------------------------------------------------------
// <copyright file="ContactMapperTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Mappers;

using D2.Geo.App.Mappers;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.Enums;
using D2.Geo.Domain.ValueObjects;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for <see cref="ContactMapper"/>.
/// </summary>
public class ContactMapperTests
{
    #region ToDTO Tests

    /// <summary>
    /// Tests that ToDTO maps all properties correctly.
    /// </summary>
    [Fact]
    public void ToDTO_WithFullContact_MapsAllProperties()
    {
        // Arrange
        var relatedEntityId = Guid.NewGuid();
        var contact = Contact.Create(
            contextKey: "test-context",
            relatedEntityId: relatedEntityId,
            contactMethods: ContactMethods.Create(
                emails: [EmailAddress.Create("john@example.com", ["primary", "work"])],
                phoneNumbers: [PhoneNumber.Create("+1234567890", ["mobile"])]),
            personalDetails: Personal.Create(
                firstName: "John",
                lastName: "Doe",
                title: NameTitle.Mr),
            professionalDetails: Professional.Create(
                companyName: "ACME Corp",
                jobTitle: "Engineer"),
            locationHashId: "location123");

        // Act
        var dto = contact.ToDTO();

        // Assert
        dto.Id.Should().Be(contact.Id.ToString());
        dto.CreatedAt.Should().NotBeNull();
        dto.ContextKey.Should().Be("test-context");
        dto.RelatedEntityId.Should().Be(relatedEntityId.ToString());
        dto.ContactMethods.Should().NotBeNull();
        dto.ContactMethods!.Emails.Should().HaveCount(1);
        dto.ContactMethods.Emails[0].Value.Should().Be("john@example.com");
        dto.PersonalDetails.Should().NotBeNull();
        dto.PersonalDetails!.FirstName.Should().Be("John");
        dto.PersonalDetails.LastName.Should().Be("Doe");
        dto.ProfessionalDetails.Should().NotBeNull();
        dto.ProfessionalDetails!.CompanyName.Should().Be("ACME Corp");
        dto.LocationHashId.Should().Be("location123");
    }

    /// <summary>
    /// Tests that ToDTO handles null optional properties.
    /// </summary>
    [Fact]
    public void ToDTO_WithMinimalContact_HandlesNulls()
    {
        // Arrange
        var contact = Contact.Create(
            contextKey: "minimal-context",
            relatedEntityId: Guid.NewGuid());

        // Act
        var dto = contact.ToDTO();

        // Assert
        dto.Id.Should().NotBeNullOrEmpty();
        dto.ContextKey.Should().Be("minimal-context");
        dto.ContactMethods.Should().BeNull();
        dto.PersonalDetails.Should().BeNull();
        dto.ProfessionalDetails.Should().BeNull();
        dto.LocationHashId.Should().BeEmpty();
    }

    #endregion

    #region ToDomain Tests

    /// <summary>
    /// Tests that ToDomain maps all properties correctly.
    /// </summary>
    [Fact]
    public void ToDomain_WithFullDTO_MapsAllProperties()
    {
        // Arrange
        var relatedEntityId = Guid.NewGuid();
        var dto = new ContactDTO
        {
            Id = Guid.NewGuid().ToString(),
            ContextKey = "test-context",
            RelatedEntityId = relatedEntityId.ToString(),
            ContactMethods = new ContactMethodsDTO
            {
                Emails = { new EmailAddressDTO { Value = "jane@example.com", Labels = { "primary" } } },
                PhoneNumbers = { new PhoneNumberDTO { Value = "+9876543210", Labels = { "work" } } },
            },
            PersonalDetails = new PersonalDTO
            {
                FirstName = "Jane",
                LastName = "Smith",
                Title = "Ms",
            },
            ProfessionalDetails = new ProfessionalDTO
            {
                CompanyName = "Tech Inc",
                JobTitle = "Manager",
            },
            LocationHashId = "location456",
        };

        // Act
        var domain = dto.ToDomain();

        // Assert
        domain.Id.Should().NotBe(Guid.Empty); // New ID generated
        domain.ContextKey.Should().Be("test-context");
        domain.RelatedEntityId.Should().Be(relatedEntityId);
        domain.ContactMethods.Should().NotBeNull();
        domain.ContactMethods!.Emails.Should().HaveCount(1);
        domain.ContactMethods.Emails[0].Value.Should().Be("jane@example.com");
        domain.PersonalDetails.Should().NotBeNull();
        domain.PersonalDetails!.FirstName.Should().Be("Jane");
        domain.ProfessionalDetails.Should().NotBeNull();
        domain.ProfessionalDetails!.CompanyName.Should().Be("Tech Inc");
        domain.LocationHashId.Should().Be("location456");
    }

    /// <summary>
    /// Tests that ToDomain handles empty locationHashId as null.
    /// </summary>
    [Fact]
    public void ToDomain_WithEmptyLocationHashId_TreatsAsNull()
    {
        // Arrange
        var dto = new ContactDTO
        {
            ContextKey = "test-context",
            RelatedEntityId = Guid.NewGuid().ToString(),
            LocationHashId = string.Empty,
        };

        // Act
        var domain = dto.ToDomain();

        // Assert
        domain.LocationHashId.Should().BeNull();
    }

    #endregion

    #region ContactToCreateDTO Tests

    /// <summary>
    /// Tests that ContactToCreateDTO.ToDomain creates correct domain object.
    /// </summary>
    [Fact]
    public void ContactToCreateDTO_ToDomain_CreatesValidContact()
    {
        // Arrange
        var relatedEntityId = Guid.NewGuid();
        var createDto = new ContactToCreateDTO
        {
            ContextKey = "new-context",
            RelatedEntityId = relatedEntityId.ToString(),
            ContactMethods = new ContactMethodsDTO
            {
                Emails = { new EmailAddressDTO { Value = "new@example.com" } },
            },
            PersonalDetails = new PersonalDTO
            {
                FirstName = "New",
                LastName = "User",
            },
        };

        // Act
        var domain = createDto.ToDomain(locationHashId: "loc789");

        // Assert
        domain.Id.Should().NotBe(Guid.Empty);
        domain.ContextKey.Should().Be("new-context");
        domain.RelatedEntityId.Should().Be(relatedEntityId);
        domain.ContactMethods!.Emails.Should().HaveCount(1);
        domain.PersonalDetails!.FirstName.Should().Be("New");
        domain.LocationHashId.Should().Be("loc789");
    }

    /// <summary>
    /// Tests that ContactToCreateDTO.ToDomain handles null locationHashId.
    /// </summary>
    [Fact]
    public void ContactToCreateDTO_ToDomain_WithNullLocationHashId_SetsNull()
    {
        // Arrange
        var createDto = new ContactToCreateDTO
        {
            ContextKey = "context",
            RelatedEntityId = Guid.NewGuid().ToString(),
        };

        // Act
        var domain = createDto.ToDomain(locationHashId: null);

        // Assert
        domain.LocationHashId.Should().BeNull();
    }

    #endregion

    #region Round-Trip Tests

    /// <summary>
    /// Tests that domain to DTO to domain preserves key data.
    /// </summary>
    [Fact]
    public void RoundTrip_DomainToDTOToDomain_PreservesKeyData()
    {
        // Arrange
        var relatedEntityId = Guid.NewGuid();
        var original = Contact.Create(
            contextKey: "roundtrip-test",
            relatedEntityId: relatedEntityId,
            contactMethods: ContactMethods.Create(
                emails: [EmailAddress.Create("test@example.com", ["primary"])]),
            personalDetails: Personal.Create("Test", lastName: "User"));

        // Act
        var dto = original.ToDTO();
        var roundTripped = dto.ToDomain();

        // Assert
        roundTripped.ContextKey.Should().Be(original.ContextKey);
        roundTripped.RelatedEntityId.Should().Be(original.RelatedEntityId);
        roundTripped.ContactMethods!.Emails[0].Value.Should().Be(original.ContactMethods!.Emails[0].Value);
        roundTripped.PersonalDetails!.FirstName.Should().Be(original.PersonalDetails!.FirstName);
    }

    /// <summary>
    /// Tests that email ordering is preserved through round-trip.
    /// </summary>
    [Fact]
    public void RoundTrip_PreservesEmailOrdering()
    {
        // Arrange
        var original = Contact.Create(
            contextKey: "order-test",
            relatedEntityId: Guid.NewGuid(),
            contactMethods: ContactMethods.Create(
                emails:
                [
                    EmailAddress.Create("primary@example.com", ["primary"]),
                    EmailAddress.Create("secondary@example.com", ["secondary"]),
                    EmailAddress.Create("tertiary@example.com"),
                ]));

        // Act
        var dto = original.ToDTO();
        var roundTripped = dto.ToDomain();

        // Assert - First email should be primary
        roundTripped.ContactMethods!.PrimaryEmail!.Value.Should().Be("primary@example.com");
        roundTripped.ContactMethods.Emails[0].Value.Should().Be("primary@example.com");
        roundTripped.ContactMethods.Emails[1].Value.Should().Be("secondary@example.com");
        roundTripped.ContactMethods.Emails[2].Value.Should().Be("tertiary@example.com");
    }

    #endregion
}
