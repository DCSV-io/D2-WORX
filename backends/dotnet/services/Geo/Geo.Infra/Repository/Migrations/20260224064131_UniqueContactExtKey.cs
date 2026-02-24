// -----------------------------------------------------------------------
// <copyright file="20260224064131_UniqueContactExtKey.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

#nullable disable

namespace D2.Geo.Infra.Repository.Migrations;

using Microsoft.EntityFrameworkCore.Migrations;

/// <inheritdoc />
public partial class UniqueContactExtKey : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_contacts_context_key_related_entity_id",
            table: "contacts");

        migrationBuilder.CreateIndex(
            name: "ix_contacts_context_key_related_entity_id",
            table: "contacts",
            columns: new[] { "context_key", "related_entity_id" },
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_contacts_context_key_related_entity_id",
            table: "contacts");

        migrationBuilder.CreateIndex(
            name: "ix_contacts_context_key_related_entity_id",
            table: "contacts",
            columns: new[] { "context_key", "related_entity_id" });
    }
}
