// -----------------------------------------------------------------------
// <copyright file="RoleValues.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler.Auth;

/// <summary>
/// Organization role string values as they appear in JWT claims and database.
/// Must match the Node.js <c>ROLES</c> / <c>ROLE_HIERARCHY</c> in <c>@d2/auth-domain</c>.
/// </summary>
public static class RoleValues
{
    /// <summary>Owner — highest privileges.</summary>
    public const string OWNER = "owner";

    /// <summary>Officer — second highest.</summary>
    public const string OFFICER = "officer";

    /// <summary>Agent — standard operational role.</summary>
    public const string AGENT = "agent";

    /// <summary>Auditor — read-only, lowest privileges.</summary>
    public const string AUDITOR = "auditor";

    /// <summary>
    /// Role hierarchy — higher index = more privileges.
    /// </summary>
    public static readonly string[] HIERARCHY = [AUDITOR, AGENT, OFFICER, OWNER];

    /// <summary>
    /// Returns all roles at or above the given minimum role in the hierarchy.
    /// </summary>
    /// <param name="minRole">The minimum role (inclusive).</param>
    /// <returns>Array of roles at or above the minimum, or empty if the role is not recognized.</returns>
    public static string[] AtOrAbove(string minRole)
    {
        var idx = Array.IndexOf(HIERARCHY, minRole);
        return idx < 0 ? [] : HIERARCHY[idx..];
    }
}
