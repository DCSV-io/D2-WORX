// -----------------------------------------------------------------------
// <copyright file="RequestContextOrgEmulationTests.cs" company="DCSV">
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
/// Tests for target organization derivation and org emulation in <see cref="RequestContext"/>.
/// Target org = emulated org (when org emulation active), otherwise agent org.
/// Target org is ALWAYS populated for authenticated users with org context.
/// </summary>
public class RequestContextOrgEmulationTests
{
    #region Target Org = Agent Org (no emulation)

    /// <summary>
    /// When not emulating, target org fields should equal agent org fields.
    /// </summary>
    [Fact]
    public void TargetOrg_WhenNotEmulating_EqualsAgentOrg()
    {
        var orgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", orgId.ToString()),
            new Claim("orgName", "Acme Corp"),
            new Claim("orgType", "customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeFalse();
        rc.TargetOrgId.Should().Be(orgId);
        rc.TargetOrgName.Should().Be("Acme Corp");
        rc.TargetOrgType.Should().Be(OrgType.Customer);

        // Target should match agent exactly.
        rc.TargetOrgId.Should().Be(rc.AgentOrgId);
        rc.TargetOrgName.Should().Be(rc.AgentOrgName);
        rc.TargetOrgType.Should().Be(rc.AgentOrgType);
    }

    /// <summary>
    /// Target org is always populated even for non-staff users (customer, affiliate, etc.).
    /// </summary>
    [Fact]
    public void TargetOrg_ForNonStaffUser_AlwaysPopulated()
    {
        var orgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", orgId.ToString()),
            new Claim("orgName", "Affiliate Inc"),
            new Claim("orgType", "affiliate"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.TargetOrgId.Should().Be(orgId);
        rc.TargetOrgName.Should().Be("Affiliate Inc");
        rc.TargetOrgType.Should().Be(OrgType.Affiliate);
    }

    /// <summary>
    /// When authenticated but no org claims, target org fields should be null.
    /// </summary>
    [Fact]
    public void TargetOrg_NoOrgClaims_ReturnsNulls()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.AgentOrgId.Should().BeNull();
        rc.TargetOrgId.Should().BeNull();
        rc.TargetOrgName.Should().BeNull();
        rc.TargetOrgType.Should().BeNull();
    }

    #endregion

    #region Target Org = Emulated Org (org emulation active)

    /// <summary>
    /// When org emulation is active, target org should come from emulated claims.
    /// </summary>
    [Fact]
    public void TargetOrg_WhenEmulating_UsesEmulatedOrgClaims()
    {
        var agentOrgId = Guid.NewGuid();
        var emulatedOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", agentOrgId.ToString()),
            new Claim("orgName", "Support HQ"),
            new Claim("orgType", "support"),
            new Claim("isEmulating", "true"),
            new Claim("emulatedOrgId", emulatedOrgId.ToString()),
            new Claim("emulatedOrgName", "Customer Corp"),
            new Claim("emulatedOrgType", "customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeTrue();

        // Target = emulated org.
        rc.TargetOrgId.Should().Be(emulatedOrgId);
        rc.TargetOrgName.Should().Be("Customer Corp");
        rc.TargetOrgType.Should().Be(OrgType.Customer);

        // Agent unchanged.
        rc.AgentOrgId.Should().Be(agentOrgId);
        rc.AgentOrgName.Should().Be("Support HQ");
        rc.AgentOrgType.Should().Be(OrgType.Support);
    }

    /// <summary>
    /// IsOrgEmulating comparison is case-insensitive ("True" = "true").
    /// </summary>
    [Fact]
    public void IsOrgEmulating_CaseInsensitive_StillTrue()
    {
        var emulatedOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", Guid.NewGuid().ToString()),
            new Claim("orgType", "admin"),
            new Claim("isEmulating", "True"),
            new Claim("emulatedOrgId", emulatedOrgId.ToString()),
            new Claim("emulatedOrgType", "customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeTrue();
        rc.TargetOrgId.Should().Be(emulatedOrgId);
    }

    /// <summary>
    /// When isEmulating is "false", org emulation is not active.
    /// </summary>
    [Fact]
    public void IsOrgEmulating_WhenFalse_TargetEqualsAgent()
    {
        var agentOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", agentOrgId.ToString()),
            new Claim("orgType", "admin"),
            new Claim("isEmulating", "false"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeFalse();
        rc.TargetOrgId.Should().Be(agentOrgId);
    }

    #endregion

    #region Emulation Fallback (missing emulated claims)

    /// <summary>
    /// When emulating but emulated org ID is missing, falls back to agent org ID.
    /// </summary>
    [Fact]
    public void TargetOrg_EmulatingButMissingEmulatedId_FallsBackToAgentId()
    {
        var agentOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", agentOrgId.ToString()),
            new Claim("orgName", "Admin HQ"),
            new Claim("orgType", "admin"),
            new Claim("isEmulating", "true"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeTrue();
        rc.TargetOrgId.Should().Be(agentOrgId);
        rc.TargetOrgName.Should().Be("Admin HQ");
        rc.TargetOrgType.Should().Be(OrgType.Admin);
    }

    /// <summary>
    /// When emulating, partial emulated claims present — filled claims used, missing fall back.
    /// </summary>
    [Fact]
    public void TargetOrg_EmulatingWithPartialClaims_MixesFallback()
    {
        var agentOrgId = Guid.NewGuid();
        var emulatedOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", agentOrgId.ToString()),
            new Claim("orgName", "Admin HQ"),
            new Claim("orgType", "admin"),
            new Claim("isEmulating", "true"),
            new Claim("emulatedOrgId", emulatedOrgId.ToString()));

        // emulatedOrgName and emulatedOrgType not provided.
        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeTrue();
        rc.TargetOrgId.Should().Be(emulatedOrgId);
        rc.TargetOrgName.Should().Be("Admin HQ"); // Fallback to agent.
        rc.TargetOrgType.Should().Be(OrgType.Admin); // Fallback to agent.
    }

    #endregion

    #region IsTargetingStaff / IsTargetingAdmin (computed from target org)

    /// <summary>
    /// When target org type is support, IsTargetingStaff is true but IsTargetingAdmin is false.
    /// </summary>
    [Fact]
    public void IsTargetingStaff_WhenTargetIsSupport_True()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", Guid.NewGuid().ToString()),
            new Claim("orgType", "support"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsTargetingStaff.Should().BeTrue();
        rc.IsTargetingAdmin.Should().BeFalse();
    }

    /// <summary>
    /// When target org type is admin, both IsTargetingStaff and IsTargetingAdmin are true.
    /// </summary>
    [Fact]
    public void IsTargetingAdmin_WhenTargetIsAdmin_True()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", Guid.NewGuid().ToString()),
            new Claim("orgType", "admin"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsTargetingStaff.Should().BeTrue();
        rc.IsTargetingAdmin.Should().BeTrue();
    }

    /// <summary>
    /// When emulating a customer org, IsTargetingStaff is false even if agent is staff.
    /// </summary>
    [Fact]
    public void IsTargetingStaff_WhenEmulatingCustomer_False()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", Guid.NewGuid().ToString()),
            new Claim("orgType", "admin"),
            new Claim("isEmulating", "true"),
            new Claim("emulatedOrgId", Guid.NewGuid().ToString()),
            new Claim("emulatedOrgType", "customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAgentStaff.Should().BeTrue();
        rc.IsTargetingStaff.Should().BeFalse();
        rc.IsTargetingAdmin.Should().BeFalse();
    }

    /// <summary>
    /// When not emulating, IsTargetingStaff and IsAgentStaff should match.
    /// </summary>
    [Fact]
    public void IsTargetingStaff_WhenNotEmulating_MatchesIsAgentStaff()
    {
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", Guid.NewGuid().ToString()),
            new Claim("orgType", "customer"));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsAgentStaff.Should().BeFalse();
        rc.IsTargetingStaff.Should().BeFalse();
        rc.IsAgentStaff.Should().Be(rc.IsTargetingStaff);
    }

    #endregion

    #region Org Emulation + User Impersonation (independent)

    /// <summary>
    /// Org emulation and user impersonation can coexist — they are independent concerns.
    /// </summary>
    [Fact]
    public void OrgEmulationAndUserImpersonation_AreIndependent()
    {
        var adminId = Guid.NewGuid();
        var emulatedOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", Guid.NewGuid().ToString()),
            new Claim("orgType", "admin"),
            new Claim("isEmulating", "true"),
            new Claim("emulatedOrgId", emulatedOrgId.ToString()),
            new Claim("emulatedOrgType", "customer"),
            new Claim("isImpersonating", "true"),
            new Claim("impersonatedBy", adminId.ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeTrue();
        rc.IsUserImpersonating.Should().BeTrue();
        rc.ImpersonatedBy.Should().Be(adminId);
        rc.TargetOrgId.Should().Be(emulatedOrgId);
    }

    /// <summary>
    /// User impersonation without org emulation — target org still equals agent org.
    /// </summary>
    [Fact]
    public void UserImpersonation_WithoutOrgEmulation_TargetEqualsAgent()
    {
        var agentOrgId = Guid.NewGuid();
        var context = CreateContextWithClaims(
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("orgId", agentOrgId.ToString()),
            new Claim("orgType", "customer"),
            new Claim("isImpersonating", "true"),
            new Claim("impersonatedBy", Guid.NewGuid().ToString()));

        var rc = new RequestContext(CreateAccessor(context));

        rc.IsOrgEmulating.Should().BeFalse();
        rc.IsUserImpersonating.Should().BeTrue();
        rc.TargetOrgId.Should().Be(agentOrgId);
    }

    #endregion

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
