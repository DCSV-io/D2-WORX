// -----------------------------------------------------------------------
// <copyright file="OrgTypeValues.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler.Auth;

/// <summary>
/// Organization type string values as they appear in JWT claims and database.
/// Must match the Node.js <c>ORG_TYPES</c> in <c>@d2/auth-domain</c>.
/// </summary>
public static class OrgTypeValues
{
    /// <summary>Administrative organization.</summary>
    public const string ADMIN = "admin";

    /// <summary>Support organization.</summary>
    public const string SUPPORT = "support";

    /// <summary>Customer organization.</summary>
    public const string CUSTOMER = "customer";

    /// <summary>Third-party / customer client organization.</summary>
    public const string THIRD_PARTY = "third_party";

    /// <summary>Affiliate organization.</summary>
    public const string AFFILIATE = "affiliate";

    /// <summary>Staff org types (admin + support).</summary>
    public static readonly string[] SR_Staff = [ADMIN, SUPPORT];

    /// <summary>All org types.</summary>
    public static readonly string[] SR_All = [ADMIN, SUPPORT, CUSTOMER, THIRD_PARTY, AFFILIATE];
}
