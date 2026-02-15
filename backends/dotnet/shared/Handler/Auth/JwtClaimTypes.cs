// -----------------------------------------------------------------------
// <copyright file="JwtClaimTypes.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler.Auth;

/// <summary>
/// JWT claim type names used across the D2 platform.
/// Must match the Node.js <c>JWT_CLAIM_TYPES</c> in <c>@d2/auth-domain</c>.
/// </summary>
public static class JwtClaimTypes
{
    /// <summary>Subject — the user ID.</summary>
    public const string SUB = "sub";

    /// <summary>User email address.</summary>
    public const string EMAIL = "email";

    /// <summary>Display name.</summary>
    public const string NAME = "name";

    /// <summary>Agent organization ID (user's actual org membership).</summary>
    public const string ORG_ID = "orgId";

    /// <summary>Agent organization name.</summary>
    public const string ORG_NAME = "orgName";

    /// <summary>Agent organization type (admin, support, customer, third_party, affiliate).</summary>
    public const string ORG_TYPE = "orgType";

    /// <summary>User's role in the agent organization (owner, officer, agent, auditor).</summary>
    public const string ROLE = "role";

    /// <summary>Emulated organization ID (org emulation — staff viewing another org).</summary>
    public const string EMULATED_ORG_ID = "emulatedOrgId";

    /// <summary>Emulated organization name (org emulation).</summary>
    public const string EMULATED_ORG_NAME = "emulatedOrgName";

    /// <summary>Emulated organization type (org emulation).</summary>
    public const string EMULATED_ORG_TYPE = "emulatedOrgType";

    /// <summary>Whether org emulation is active (staff viewing another org as read-only).</summary>
    public const string IS_EMULATING = "isEmulating";

    /// <summary>Admin user ID who initiated user impersonation.</summary>
    public const string IMPERSONATED_BY = "impersonatedBy";

    /// <summary>Whether user impersonation is active (admin acting as another user).</summary>
    public const string IS_IMPERSONATING = "isImpersonating";

    /// <summary>JWT fingerprint hash (SHA-256 of User-Agent + Accept).</summary>
    public const string FINGERPRINT = "fp";
}
