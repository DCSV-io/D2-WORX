// -----------------------------------------------------------------------
// <copyright file="WhoIsConfig.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Entities;

using D2.Geo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// EF Core configuration for the <see cref="WhoIs"/> entity.
/// </summary>
public class WhoIsConfig : IEntityTypeConfiguration<WhoIs>
{
    /// <inheritdoc/>
    public void Configure(EntityTypeBuilder<WhoIs> builder)
    {
        builder.ToTable("who_is");

        // Primary key (content-addressable hash).
        builder.HasKey(w => w.HashId);
        builder.Property(w => w.HashId)
            .HasColumnName("hash_id")
            .HasMaxLength(64)
            .IsRequired();

        // Content-addressable properties.
        builder.Property(w => w.IPAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(45)
            .IsRequired();

        builder.Property(w => w.Year)
            .HasColumnName("year")
            .IsRequired();

        builder.Property(w => w.Month)
            .HasColumnName("month")
            .IsRequired();

        builder.Property(w => w.Fingerprint)
            .HasColumnName("fingerprint")
            .HasMaxLength(2048);

        // ASN properties.
        builder.Property(w => w.ASN)
            .HasColumnName("asn");

        builder.Property(w => w.ASName)
            .HasColumnName("as_name")
            .HasMaxLength(255);

        builder.Property(w => w.ASDomain)
            .HasColumnName("as_domain")
            .HasMaxLength(255);

        builder.Property(w => w.ASType)
            .HasColumnName("as_type")
            .HasMaxLength(50);

        // Carrier properties.
        builder.Property(w => w.CarrierName)
            .HasColumnName("carrier_name")
            .HasMaxLength(255);

        builder.Property(w => w.MCC)
            .HasColumnName("mcc")
            .HasMaxLength(10);

        builder.Property(w => w.MNC)
            .HasColumnName("mnc")
            .HasMaxLength(10);

        // Change tracking.
        builder.Property(w => w.ASChanged)
            .HasColumnName("as_changed");

        builder.Property(w => w.GeoChanged)
            .HasColumnName("geo_changed");

        // Network flags (nullable - null means unknown, false means definitively not).
        builder.Property(w => w.IsAnonymous)
            .HasColumnName("is_anonymous");

        builder.Property(w => w.IsAnycast)
            .HasColumnName("is_anycast");

        builder.Property(w => w.IsHosting)
            .HasColumnName("is_hosting");

        builder.Property(w => w.IsMobile)
            .HasColumnName("is_mobile");

        builder.Property(w => w.IsSatellite)
            .HasColumnName("is_satellite");

        builder.Property(w => w.IsProxy)
            .HasColumnName("is_proxy");

        builder.Property(w => w.IsRelay)
            .HasColumnName("is_relay");

        builder.Property(w => w.IsTor)
            .HasColumnName("is_tor");

        builder.Property(w => w.IsVPN)
            .HasColumnName("is_vpn");

        // Privacy.
        builder.Property(w => w.PrivacyName)
            .HasColumnName("privacy_name")
            .HasMaxLength(255);

        // Foreign key to Location.
        builder.Property(w => w.LocationHashId)
            .HasColumnName("location_hash_id")
            .HasMaxLength(64);

        builder.HasOne(w => w.Location)
            .WithMany()
            .HasForeignKey(w => w.LocationHashId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes.
        builder.HasIndex(w => w.IPAddress)
            .HasDatabaseName("ix_who_is_ip_address");

        builder.HasIndex(w => w.Fingerprint)
            .HasDatabaseName("ix_who_is_fingerprint")
            .HasFilter("fingerprint IS NOT NULL");
    }
}
