// -----------------------------------------------------------------------
// <copyright file="RequiresApiKeyAttribute.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.API.Interceptors;

/// <summary>
/// Marks a gRPC service method as requiring API key authentication.
/// The <see cref="ApiKeyInterceptor"/> reads this from endpoint metadata
/// to decide whether to enforce <c>x-api-key</c> validation.
/// </summary>
/// <remarks>
/// <para>
/// When <see cref="ValidateContextKeys"/> is <c>true</c>, the interceptor
/// additionally extracts context keys from the request payload and verifies
/// they are in the caller's allowed set (per <c>GeoAppOptions.ApiKeyMappings</c>).
/// </para>
/// <para>
/// Methods without this attribute pass through without any API key checks.
/// </para>
/// </remarks>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RequiresApiKeyAttribute : Attribute
{
    /// <summary>
    /// Gets a value indicating whether the interceptor should also
    /// validate that the request's context keys are allowed for the caller's API key.
    /// </summary>
    /// <value>
    /// <c>true</c> for ext-key RPCs (GetContactsByExtKeys, CreateContacts, etc.);
    /// <c>false</c> for internal ID-based RPCs (GetContacts, DeleteContacts) that
    /// require authentication but skip context key authorization.
    /// </value>
    public bool ValidateContextKeys { get; init; }
}
