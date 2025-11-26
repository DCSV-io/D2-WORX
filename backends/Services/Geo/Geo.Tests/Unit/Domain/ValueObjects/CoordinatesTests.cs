// -----------------------------------------------------------------------
// <copyright file="CoordinatesTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.Domain.ValueObjects;

using D2.Geo.Domain.Exceptions;
using D2.Geo.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for <see cref="Coordinates"/>.
/// </summary>
public class CoordinatesTests
{
    #region Valid Input - Creates Instance

    /// <summary>
    /// Tests that creating Coordinates with valid latitude and longitude succeeds.
    /// </summary>
    [Fact]
    public void Create_WithValidCoordinates_Success()
    {
        // Arrange
        const decimal latitude = 34.0522m;
        const decimal longitude = -118.2437m;

        // Act
        var coords = Coordinates.Create(latitude, longitude);

        // Assert
        coords.Should().NotBeNull();
        coords.Latitude.Should().Be(34.0522m);
        coords.Longitude.Should().Be(-118.2437m);
    }

    /// <summary>
    /// Tests that creating Coordinates with boundary values succeeds.
    /// </summary>
    ///
    /// <param name="lat">
    /// The latitude value.
    /// </param>
    /// <param name="lon">
    /// The longitude value.
    /// </param>
    [Theory]
    [InlineData(0, 0)]
    [InlineData(90, 180)]
    [InlineData(-90, -180)]
    [InlineData(45.5, 90.5)]
    public void Create_WithValidBoundaryValues_Success(double lat, double lon)
    {
        // Act
        var coords = Coordinates.Create((decimal)lat, (decimal)lon);

        // Assert
        coords.Should().NotBeNull();
        coords.Latitude.Should().Be((decimal)lat);
        coords.Longitude.Should().Be((decimal)lon);
    }

    #endregion

    #region Precision - 5 Decimal Places

    /// <summary>
    /// Tests that creating Coordinates quantizes latitude and longitude to 5 decimal places.
    /// </summary>
    [Fact]
    public void Create_QuantizesTo5DecimalPlaces()
    {
        // Arrange
        const decimal lat = 34.052234567m;
        const decimal lon = -118.243745678m;

        // Act
        var coords = Coordinates.Create(lat, lon);

        // Assert
        coords.Latitude.Should().Be(34.05223m);
        coords.Longitude.Should().Be(-118.24375m);
    }

    /// <summary>
    /// Tests that latitude is quantized correctly based on input values.
    /// </summary>
    ///
    /// <param name="input">
    /// The input latitude value.
    /// </param>
    /// <param name="expected">
    /// The expected quantized latitude value.
    /// </param>
    [Theory]
    [InlineData(34.123456, 34.12346)]
    [InlineData(34.123454, 34.12345)]
    [InlineData(-39.999999, -40.00000)]
    [InlineData(0.000001, 0.00000)]
    public void Create_QuantizesCorrectly(double input, double expected)
    {
        // Act
        var coords = Coordinates.Create((decimal)input, 0);

        // Assert
        coords.Latitude.Should().Be((decimal)expected);
    }

    #endregion

    #region Latitude Out of Range - Throws

    /// <summary>
    /// Tests that creating Coordinates with latitude out of range throws GeoValidationException.
    /// </summary>
    ///
    /// <param name="lat">
    /// The latitude value.
    /// </param>
    [Theory]
    [InlineData(90.1)]
    [InlineData(91)]
    [InlineData(100)]
    [InlineData(180)]
    public void Create_WithLatitudeTooHigh_ThrowsGeoValidationException(double lat)
    {
        // Act
        var act = () => Coordinates.Create((decimal)lat, 0);

        // Assert
        act.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that creating Coordinates with latitude out of range throws GeoValidationException.
    /// </summary>
    /// <param name="lat">
    /// The latitude value.
    /// </param>
    [Theory]
    [InlineData(-90.1)]
    [InlineData(-91)]
    [InlineData(-100)]
    [InlineData(-180)]
    public void Create_WithLatitudeTooLow_ThrowsGeoValidationException(double lat)
    {
        // Act
        var act = () => Coordinates.Create((decimal)lat, 0);

        // Assert
        act.Should().Throw<GeoValidationException>();
    }

    #endregion

    #region Longitude Out of Range - Throws

    /// <summary>
    /// Tests that creating Coordinates with longitude out of range throws GeoValidationException.
    /// </summary>
    /// <param name="lon">
    /// The longitude value.
    /// </param>
    [Theory]
    [InlineData(180.1)]
    [InlineData(181)]
    [InlineData(200)]
    [InlineData(360)]
    public void Create_WithLongitudeTooHigh_ThrowsGeoValidationException(double lon)
    {
        // Act
        var act = () => Coordinates.Create(0, (decimal)lon);

        // Assert
        act.Should().Throw<GeoValidationException>();
    }

    /// <summary>
    /// Tests that creating Coordinates with longitude out of range throws GeoValidationException.
    /// </summary>
    ///
    /// <param name="lon">
    /// The longitude value.
    /// </param>
    [Theory]
    [InlineData(-180.1)]
    [InlineData(-181)]
    [InlineData(-200)]
    [InlineData(-360)]
    public void Create_WithLongitudeTooLow_ThrowsGeoValidationException(double lon)
    {
        // Act
        var act = () => Coordinates.Create(0, (decimal)lon);

        // Assert
        act.Should().Throw<GeoValidationException>();
    }

    #endregion

    #region Create From Existing

    /// <summary>
    /// Tests that Create from existing Coordinates produces an equal instance.
    /// </summary>
    [Fact]
    public void Create_FromExistingCoordinates_Success()
    {
        // Arrange
        var original = Coordinates.Create(34.0522m, -118.2437m);

        // Act
        var copy = Coordinates.Create(original);

        // Assert
        copy.Should().Be(original);
    }

    /// <summary>
    /// Tests that Create from invalid existing Coordinates throws GeoValidationException.
    /// </summary>
    [Fact]
    public void Create_WithInvalidExistingCoordinates_ThrowsGeoValidationException()
    {
        // Arrange - Create invalid coordinates by bypassing factory
        var invalid = new Coordinates
        {
            Latitude = 91m, // Invalid - out of range
            Longitude = 0m,
        };

        // Act
        var act = () => Coordinates.Create(invalid);

        // Assert
        act.Should().Throw<GeoValidationException>();
    }

    #endregion
}
