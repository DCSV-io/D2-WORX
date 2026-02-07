// -----------------------------------------------------------------------
// <copyright file="BatchOptionsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.BatchPg;

using D2.Shared.Batch.Pg;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for <see cref="BatchOptions"/>.
/// </summary>
public class BatchOptionsTests
{
    #region Default Values

    /// <summary>
    /// Tests that default BatchSize is 500.
    /// </summary>
    [Fact]
    public void BatchSize_Default_Is500()
    {
        // Arrange & Act
        var options = new BatchOptions();

        // Assert
        options.BatchSize.Should().Be(500);
    }

    /// <summary>
    /// Tests that default AsNoTracking is true.
    /// </summary>
    [Fact]
    public void AsNoTracking_Default_IsTrue()
    {
        // Arrange & Act
        var options = new BatchOptions();

        // Assert
        options.AsNoTracking.Should().BeTrue();
    }

    /// <summary>
    /// Tests that default DeduplicateIds is true.
    /// </summary>
    [Fact]
    public void DeduplicateIds_Default_IsTrue()
    {
        // Arrange & Act
        var options = new BatchOptions();

        // Assert
        options.DeduplicateIds.Should().BeTrue();
    }

    /// <summary>
    /// Tests that default FilterNullIds is true.
    /// </summary>
    [Fact]
    public void FilterNullIds_Default_IsTrue()
    {
        // Arrange & Act
        var options = new BatchOptions();

        // Assert
        options.FilterNullIds.Should().BeTrue();
    }

    #endregion

    #region Custom Values

    /// <summary>
    /// Tests that BatchSize can be customized.
    /// </summary>
    ///
    /// <param name="batchSize">
    /// The batch size to test.
    /// </param>
    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(1000)]
    [InlineData(10000)]
    public void BatchSize_CanBeCustomized(int batchSize)
    {
        // Arrange & Act
        var options = new BatchOptions { BatchSize = batchSize };

        // Assert
        options.BatchSize.Should().Be(batchSize);
    }

    /// <summary>
    /// Tests that AsNoTracking can be set to false.
    /// </summary>
    [Fact]
    public void AsNoTracking_CanBeSetToFalse()
    {
        // Arrange & Act
        var options = new BatchOptions { AsNoTracking = false };

        // Assert
        options.AsNoTracking.Should().BeFalse();
    }

    /// <summary>
    /// Tests that DeduplicateIds can be set to false.
    /// </summary>
    [Fact]
    public void DeduplicateIds_CanBeSetToFalse()
    {
        // Arrange & Act
        var options = new BatchOptions { DeduplicateIds = false };

        // Assert
        options.DeduplicateIds.Should().BeFalse();
    }

    /// <summary>
    /// Tests that FilterNullIds can be set to false.
    /// </summary>
    [Fact]
    public void FilterNullIds_CanBeSetToFalse()
    {
        // Arrange & Act
        var options = new BatchOptions { FilterNullIds = false };

        // Assert
        options.FilterNullIds.Should().BeFalse();
    }

    #endregion
}
