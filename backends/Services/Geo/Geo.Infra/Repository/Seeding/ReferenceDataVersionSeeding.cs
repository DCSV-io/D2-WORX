// -----------------------------------------------------------------------
// <copyright file="ReferenceDataVersionSeeding.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Seeding;

using D2.Geo.Infra.Repository.Entities;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Extension methods for seeding reference data version.
/// </summary>
public static class ReferenceDataVersionSeeding
{
    /// <summary>
    /// Seeds the ReferenceDataVersion entity.
    /// </summary>
    ///
    /// <param name="modelBuilder">
    /// The model builder to configure the entity model.
    /// </param>
    extension(ModelBuilder modelBuilder)
    {
        /// <summary>
        /// Seeds the ReferenceDataVersion entity.
        /// </summary>
        public void SeedReferenceDataVersion()
        {
            modelBuilder.Entity<ReferenceDataVersion>().HasData(
                new ReferenceDataVersion
                {
                    Id = 0,
                    Version = "1.0.0",
                    UpdatedAt = new DateTime(2025, 11, 24, 8, 48, 0, DateTimeKind.Utc),
                });
        }
    }
}
