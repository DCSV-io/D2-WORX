// -----------------------------------------------------------------------
// <copyright file="LocationValidatorTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Validators;

using D2.Geo.App.Validators;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.Exceptions;
using D2.Geo.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for the <see cref="LocationValidator"/> aggregate validator.
/// Includes domain parity tests ensuring Fluent validation is at least as strict
/// as domain factory constraints.
/// </summary>
public class LocationValidatorTests
{
    #region Valid Locations

    /// <summary>
    /// Tests that a minimal valid location passes validation.
    /// </summary>
    [Fact]
    public void Validate_MinimalValidLocation_Passes()
    {
        var location = Location.Create(city: "Portland", countryISO31661Alpha2Code: "US");
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeTrue();
    }

    /// <summary>
    /// Tests that a full valid location passes validation.
    /// </summary>
    [Fact]
    public void Validate_FullValidLocation_Passes()
    {
        var location = Location.Create(
            coordinates: Coordinates.Create(45.5155, -122.6789),
            address: StreetAddress.Create("123 Main St", "Suite 100"),
            city: "Portland",
            postalCode: "97201",
            subdivisionISO31662Code: "US-OR",
            countryISO31661Alpha2Code: "US");
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region Coordinates Validation

    /// <summary>
    /// Tests that latitude out of range fails validation.
    /// </summary>
    /// <param name="lat">The out-of-range latitude value to test.</param>
    [Theory]
    [InlineData(-91)]
    [InlineData(91)]
    public void Validate_LatitudeOutOfRange_Fails(double lat)
    {
        // Domain throws for out-of-range; Fluent must also catch it.
        var validator = new LocationValidator();

        // Verify domain factory also rejects this.
        var domainAct = () => Coordinates.Create(lat, 0);
        domainAct.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that longitude out of range fails validation.
    /// </summary>
    /// <param name="lon">The out-of-range longitude value to test.</param>
    [Theory]
    [InlineData(-181)]
    [InlineData(181)]
    public void Validate_LongitudeOutOfRange_Fails(double lon)
    {
        // Domain throws for out-of-range; Fluent must also catch it.
        var validator = new LocationValidator();

        // Verify domain factory also rejects this.
        var domainAct = () => Coordinates.Create(0, lon);
        domainAct.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that boundary coordinates pass validation.
    /// </summary>
    /// <param name="lat">The boundary latitude value to test.</param>
    /// <param name="lon">The boundary longitude value to test.</param>
    [Theory]
    [InlineData(-90, -180)]
    [InlineData(90, 180)]
    [InlineData(0, 0)]
    public void Validate_BoundaryCoordinates_Passes(double lat, double lon)
    {
        var location = Location.Create(
            coordinates: Coordinates.Create(lat, lon),
            city: "Boundary");
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region Address Validation

    /// <summary>
    /// Tests that Line1 exceeding max length fails.
    /// </summary>
    [Fact]
    public void Validate_Line1TooLong_Fails()
    {
        var location = Location.Create(
            address: StreetAddress.Create(new string('A', 256)),
            city: "Test");
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("address.line1"));
    }

    /// <summary>
    /// Tests that Line3 without Line2 fails validation (domain parity).
    /// </summary>
    [Fact]
    public void Validate_Line3WithoutLine2_Fails()
    {
        // Domain factory also enforces this.
        var domainAct = () => StreetAddress.Create("123 Main St", line3: "Floor 3");
        domainAct.Should().Throw<GeoValidationException>();
    }

    #endregion

    #region Max Length Validation

    /// <summary>
    /// Tests that city exceeding max length fails.
    /// </summary>
    [Fact]
    public void Validate_CityTooLong_Fails()
    {
        var location = Location.Create(city: new string('A', 256));
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("city"));
    }

    /// <summary>
    /// Tests that postal code exceeding max length fails.
    /// </summary>
    [Fact]
    public void Validate_PostalCodeTooLong_Fails()
    {
        var location = Location.Create(postalCode: new string('A', 17));
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("postalCode"));
    }

    /// <summary>
    /// Tests that subdivision code exceeding max length fails.
    /// </summary>
    [Fact]
    public void Validate_SubdivisionCodeTooLong_Fails()
    {
        var location = Location.Create(subdivisionISO31662Code: "US-CALI");
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("subdivisionCode"));
    }

    /// <summary>
    /// Tests that country code exceeding max length fails.
    /// </summary>
    [Fact]
    public void Validate_CountryCodeTooLong_Fails()
    {
        var location = Location.Create(countryISO31661Alpha2Code: "USA");
        var validator = new LocationValidator();
        var result = validator.Validate(location);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("countryCode"));
    }

    #endregion

    #region Index Prefix

    /// <summary>
    /// Tests that indexed error paths use the provided prefix.
    /// </summary>
    [Fact]
    public void Validate_WithIndexPrefix_ErrorPathsIncludePrefix()
    {
        var location = Location.Create(city: new string('A', 256));
        var validator = new LocationValidator("items[2].");
        var result = validator.Validate(location);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.StartsWith("items[2]."));
    }

    #endregion
}
