// -----------------------------------------------------------------------
// <copyright file="RequestContextJwtTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Gateway;

using System.Security.Claims;
using D2.Shared.Handler;
using D2.Shared.Handler.Extensions;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

/// <summary>
/// Unit tests for JWT claim extraction in <see cref="RequestContext"/>.
/// </summary>
public class RequestContextJwtTests
{
    /// <summary>
    /// Tests that sub claim is extracted as UserId Guid.
    /// </summary>
    [Fact]
    public void RequestContext_ExtractsSubClaim_AsUserId()
    {
        var userId = Guid.NewGuid();
        var context = CreateContextWithClaims(new Claim("sub", userId.ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.UserId.Should().Be(userId);
    }

    /// <summary>
    /// Tests that name claim is extracted as Username.
    /// </summary>
    [Fact]
    public void RequestContext_ExtractsNameClaim_AsUsername()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("name", "John Doe"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.Username.Should().Be("John Doe");
    }

    /// <summary>
    /// Tests that orgId claim is extracted as AgentOrgId.
    /// </summary>
    [Fact]
    public void RequestContext_ExtractsOrgIdClaim_AsAgentOrgId()
    {
        var orgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", orgId.ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgId.Should().Be(orgId);
    }

    /// <summary>
    /// Tests that orgName claim is extracted as AgentOrgName.
    /// </summary>
    [Fact]
    public void RequestContext_ExtractsOrgNameClaim_AsAgentOrgName()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgName", "Acme Corp"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgName.Should().Be("Acme Corp");
    }

    /// <summary>
    /// Tests that orgType claim "admin" maps to OrgType.Admin.
    /// </summary>
    [Fact]
    public void RequestContext_ExtractsOrgTypeClaim_AsAgentOrgType()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "admin"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgType.Should().Be(OrgType.Admin);
    }

    /// <summary>
    /// Tests that orgType "third_party" maps to OrgType.CustomerClient (known mismatch).
    /// </summary>
    [Fact]
    public void RequestContext_MapsThirdParty_ToCustomerClient()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "third_party"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgType.Should().Be(OrgType.CustomerClient);
    }

    /// <summary>
    /// Tests that missing claims result in null values.
    /// </summary>
    [Fact]
    public void RequestContext_WithMissingClaims_ReturnsNulls()
    {
        // Authenticated but no org claims.
        var context = CreateContextWithClaims(new Claim("sub", Guid.NewGuid().ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgId.Should().BeNull();
        rc.AgentOrgName.Should().BeNull();
        rc.AgentOrgType.Should().BeNull();
        rc.TargetOrgId.Should().BeNull();
        rc.TargetOrgName.Should().BeNull();
        rc.TargetOrgType.Should().BeNull();
    }

    /// <summary>
    /// Tests that IsAuthenticated is true when JWT is present.
    /// </summary>
    [Fact]
    public void RequestContext_WhenAuthenticated_IsAuthenticatedTrue()
    {
        var context = CreateContextWithClaims(new Claim("sub", Guid.NewGuid().ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAuthenticated.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IsAuthenticated is false when no JWT is present.
    /// </summary>
    [Fact]
    public void RequestContext_WhenNotAuthenticated_IsAuthenticatedFalse()
    {
        var context = new DefaultHttpContext();

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAuthenticated.Should().BeFalse();
        rc.UserId.Should().BeNull();
    }

    /// <summary>
    /// Tests that IsAgentStaff is computed from AgentOrgType.
    /// </summary>
    [Fact]
    public void RequestContext_WithSupportOrgType_IsAgentStaffTrue()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "support"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAgentStaff.Should().BeTrue();
        rc.IsAgentAdmin.Should().BeFalse();
    }

    /// <summary>
    /// Tests that invalid Guid in sub claim results in null UserId.
    /// </summary>
    [Fact]
    public void RequestContext_WithInvalidGuidInSubClaim_ReturnsNullUserId()
    {
        var context = CreateContextWithClaims(new Claim("sub", "not-a-guid"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.UserId.Should().BeNull();
    }

    /// <summary>
    /// Tests that orgType mapping is case-insensitive.
    /// </summary>
    [Fact]
    public void RequestContext_OrgTypeMapping_IsCaseInsensitive()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "Customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgType.Should().Be(OrgType.Customer);
    }

    /// <summary>
    /// Tests that ImpersonatedBy is extracted from impersonatedBy claim as Guid.
    /// </summary>
    [Fact]
    public void RequestContext_ExtractsImpersonatedByClaim_AsGuid()
    {
        var adminId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("impersonatedBy", adminId.ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.ImpersonatedBy.Should().Be(adminId);
    }

    /// <summary>
    /// Tests that IsUserImpersonating is true when isImpersonating claim is "true".
    /// </summary>
    [Fact]
    public void RequestContext_IsUserImpersonatingTrue_WhenClaimPresent()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("isImpersonating", "true"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsUserImpersonating.Should().BeTrue();
    }

    /// <summary>
    /// Tests that missing user impersonation claims result in null/false.
    /// </summary>
    [Fact]
    public void RequestContext_MissingImpersonationClaims_ReturnsDefaults()
    {
        var context = CreateContextWithClaims(new Claim("sub", Guid.NewGuid().ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.ImpersonatedBy.Should().BeNull();
        rc.IsUserImpersonating.Should().BeFalse();
    }

    /// <summary>
    /// When orgType is "affiliate", maps to OrgType.Affiliate.
    /// </summary>
    [Fact]
    public void RequestContext_AffiliateOrgType_MapsCorrectly()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "affiliate"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgType.Should().Be(OrgType.Affiliate);
    }

    /// <summary>
    /// When orgType is unrecognized, returns null (not an exception).
    /// </summary>
    [Fact]
    public void RequestContext_UnknownOrgType_ReturnsNull()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "invalid_type"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgType.Should().BeNull();
    }

    /// <summary>
    /// When IsAgentAdmin is true, IsAgentStaff is also true.
    /// </summary>
    [Fact]
    public void RequestContext_AdminOrgType_IsAgentStaffAndAdmin()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "admin"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAgentStaff.Should().BeTrue();
        rc.IsAgentAdmin.Should().BeTrue();
    }

    /// <summary>
    /// Customer org type should not be staff or admin.
    /// </summary>
    [Fact]
    public void RequestContext_CustomerOrgType_NotStaffNotAdmin()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgType", "customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAgentStaff.Should().BeFalse();
        rc.IsAgentAdmin.Should().BeFalse();
    }

    /// <summary>
    /// When null HttpContext, all properties are null/false.
    /// </summary>
    [Fact]
    public void RequestContext_NullHttpContext_ReturnsDefaults()
    {
        var mock = new Mock<IHttpContextAccessor>();
        mock.Setup(a => a.HttpContext).Returns((HttpContext?)null);

        var rc = new RequestContext(mock.Object);

        rc.IsAuthenticated.Should().BeFalse();
        rc.UserId.Should().BeNull();
        rc.AgentOrgId.Should().BeNull();
        rc.AgentOrgName.Should().BeNull();
        rc.AgentOrgType.Should().BeNull();
        rc.TargetOrgId.Should().BeNull();
        rc.TargetOrgName.Should().BeNull();
        rc.TargetOrgType.Should().BeNull();
        rc.IsOrgEmulating.Should().BeFalse();
        rc.ImpersonatedBy.Should().BeNull();
        rc.IsUserImpersonating.Should().BeFalse();
        rc.IsAgentStaff.Should().BeFalse();
        rc.IsAgentAdmin.Should().BeFalse();
        rc.IsTargetingStaff.Should().BeFalse();
        rc.IsTargetingAdmin.Should().BeFalse();
    }

    #region Helpers

    private static DefaultHttpContext CreateContextWithClaims(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, "Bearer");
        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity),
        };
    }

    private static IHttpContextAccessor CreateAccessor(HttpContext context)
    {
        var mock = new Mock<IHttpContextAccessor>();
        mock.Setup(a => a.HttpContext).Returns(context);
        return mock.Object;
    }

    #endregion
}
