// -----------------------------------------------------------------------
// <copyright file="20260313232817_AddContactIETFBCP47TagAndCleanupWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

#nullable disable

namespace D2.Geo.Infra.Repository.Migrations;

using Microsoft.EntityFrameworkCore.Migrations;

/// <inheritdoc />
public partial class AddContactIETFBCP47TagAndCleanupWhoIs : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_who_is_fingerprint",
            table: "who_is");

        migrationBuilder.DropColumn(
            name: "fingerprint",
            table: "who_is");

        migrationBuilder.AddColumn<string>(
            name: "ietf_bcp47_tag",
            table: "contacts",
            type: "character varying(35)",
            maxLength: 35,
            nullable: false,
            defaultValue: "en-US");

        migrationBuilder.CreateIndex(
            name: "IX_contacts_ietf_bcp47_tag",
            table: "contacts",
            column: "ietf_bcp47_tag");

        migrationBuilder.AddForeignKey(
            name: "FK_contacts_locales_ietf_bcp47_tag",
            table: "contacts",
            column: "ietf_bcp47_tag",
            principalTable: "locales",
            principalColumn: "ietf_bcp_47_tag",
            onDelete: ReferentialAction.Restrict);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_contacts_locales_ietf_bcp47_tag",
            table: "contacts");

        migrationBuilder.DropIndex(
            name: "IX_contacts_ietf_bcp47_tag",
            table: "contacts");

        migrationBuilder.DropColumn(
            name: "ietf_bcp47_tag",
            table: "contacts");

        migrationBuilder.AddColumn<string>(
            name: "fingerprint",
            table: "who_is",
            type: "character varying(2048)",
            maxLength: 2048,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "ix_who_is_fingerprint",
            table: "who_is",
            column: "fingerprint",
            filter: "fingerprint IS NOT NULL");
    }
}
