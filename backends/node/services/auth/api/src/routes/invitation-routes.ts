import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result, HttpStatusCode } from "@d2/result";
import { SESSION_FIELDS, GEO_CONTEXT_KEYS } from "@d2/auth-domain";
import { IPublishInvitationEmailKey } from "@d2/auth-app";
import { ICreateContactsKey } from "@d2/geo-client";
import type { Auth } from "@d2/auth-infra";
import { user as userTable, organization as orgTable } from "@d2/auth-infra";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SessionVariables } from "../middleware/session.js";
import { SCOPE_KEY, type ScopeVariables } from "../middleware/scope.js";
import { requireOrg, requireRole } from "../middleware/authorization.js";

/**
 * Custom invitation route that replaces BetterAuth's `sendInvitationEmail` callback.
 *
 * Flow:
 *   1. Validate input (email, role, optional contact details)
 *   2. Look up user by email in auth DB
 *   3. Call BetterAuth `createInvitation` → get invitationId
 *   4. If user NOT found: create Geo contact for the invitee
 *   5. Publish invitation email event with inviteeUserId or inviteeContactId
 *   6. Return { invitationId }
 */
export function createInvitationRoutes(auth: Auth, db: NodePgDatabase, baseUrl: string) {
  const app = new Hono<{ Variables: SessionVariables & ScopeVariables }>();

  app.post("/api/invitations", requireOrg(), requireRole("officer"), async (c) => {
    const body = await c.req.json();

    // 1. Validate input
    const email = (body.email as string | undefined)?.trim();
    const role = body.role as string | undefined;
    if (!email || !role) {
      const inputErrors: [string, ...string[]][] = [];
      if (!email) inputErrors.push(["email", "Email is required."]);
      if (!role) inputErrors.push(["role", "Role is required."]);
      return c.json(D2Result.validationFailed({ inputErrors }), 400 as ContentfulStatusCode);
    }

    const session = c.get("session")!;
    const organizationId = session[SESSION_FIELDS.ACTIVE_ORG_ID] as string;
    const inviter = c.get("user")!;

    // 2. Look up user by email
    const existingUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, email.toLowerCase()))
      .limit(1);
    const existingUser = existingUsers[0];

    // 3. Call BetterAuth createInvitation
    let invitationId: string;
    try {
      const invitationResult = (await auth.api.createInvitation({
        headers: c.req.raw.headers,
        body: {
          email,
          organizationId,
          role: role as "owner" | "officer" | "agent" | "auditor",
        },
      })) as { id: string };
      invitationId = invitationResult.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create invitation.";
      return c.json(
        D2Result.fail({
          messages: [message],
          statusCode: HttpStatusCode.BadRequest,
        }),
        400 as ContentfulStatusCode,
      );
    }

    // 4. If user NOT found, create a Geo contact for the invitee
    let inviteeContactId: string | undefined;
    if (!existingUser) {
      const firstName = (body.firstName as string) ?? "";
      const lastName = (body.lastName as string) ?? "";
      const phone = (body.phone as string) ?? "";

      const scope = c.get(SCOPE_KEY);
      const createContacts = scope.resolve(ICreateContactsKey);

      const contactResult = await createContacts.handleAsync({
        contacts: [
          {
            createdAt: new Date(),
            contextKey: GEO_CONTEXT_KEYS.ORG_INVITATION,
            relatedEntityId: invitationId,
            contactMethods: {
              emails: [{ value: email, labels: [] }],
              phoneNumbers: phone ? [{ value: phone, labels: [] }] : [],
            },
            personalDetails: {
              firstName,
              lastName,
              title: "",
              preferredName: "",
              middleName: "",
              generationalSuffix: "",
              professionalCredentials: [],
              dateOfBirth: "",
              biologicalSex: "",
            },
            professionalDetails: undefined,
            location: undefined,
          },
        ],
      });

      if (contactResult.success && contactResult.data?.data[0]) {
        inviteeContactId = contactResult.data.data[0].id;
      }
    }

    // 5. Look up org name for the email
    const orgs = await db
      .select({ name: orgTable.name })
      .from(orgTable)
      .where(eq(orgTable.id, organizationId))
      .limit(1);
    const orgName = orgs[0]?.name ?? "the organization";

    // 6. Publish invitation email event
    const scope = c.get(SCOPE_KEY);
    const publishHandler = scope.resolve(IPublishInvitationEmailKey);
    const invitationUrl = `${baseUrl}/api/auth/organization/accept-invitation?invitationId=${invitationId}`;

    await publishHandler.handleAsync({
      invitationId,
      inviteeEmail: email,
      organizationId,
      organizationName: orgName,
      role,
      inviterName: inviter.name ?? "Someone",
      inviterEmail: inviter.email,
      invitationUrl,
      inviteeUserId: existingUser?.id,
      inviteeContactId,
    });

    return c.json(D2Result.ok({ data: { invitationId } }), 201 as ContentfulStatusCode);
  });

  return app;
}
