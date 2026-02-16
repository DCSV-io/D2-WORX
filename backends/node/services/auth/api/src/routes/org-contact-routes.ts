import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type D2Result, HttpStatusCode } from "@d2/result";
import { SESSION_FIELDS } from "@d2/auth-domain";
import type { SessionVariables } from "../middleware/session.js";
import { requireOrg, requireRole } from "../middleware/authorization.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = { handleAsync: (input: any) => Promise<D2Result<any>> };

interface OrgContactHandlers {
  create: Handler;
  update: Handler;
  delete: Handler;
  getByOrg: Handler;
}

/** Default and maximum page sizes for list endpoints. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Thin routes for org contact junction management.
 * Authorization is visible at route declaration via middleware.
 * All validation, IDOR checks, and business logic live in handlers.
 */
export function createOrgContactRoutes(handlers: OrgContactHandlers) {
  const app = new Hono<{ Variables: SessionVariables }>();

  // POST — Create contact (org member, officer+)
  // Body: { label, isPrimary?, contact: { contactMethods?, personalDetails?, ... } }
  app.post("/api/org-contacts", requireOrg(), requireRole("officer"), async (c) => {
    const body = await c.req.json();
    const result = await handlers.create.handleAsync({
      organizationId: c.get("session")![SESSION_FIELDS.ACTIVE_ORG_ID] as string,
      label: body.label,
      isPrimary: body.isPrimary,
      contact: body.contact ?? {},
    });
    const status = (
      result.success ? HttpStatusCode.Created : (result.statusCode ?? HttpStatusCode.BadRequest)
    ) as ContentfulStatusCode;
    return c.json(result, status);
  });

  // PATCH — Update contact (org member, officer+)
  // Body: { label?, isPrimary?, contact?: { ... } }
  app.patch("/api/org-contacts/:id", requireOrg(), requireRole("officer"), async (c) => {
    const body = await c.req.json();
    const result = await handlers.update.handleAsync({
      id: c.req.param("id"),
      organizationId: c.get("session")![SESSION_FIELDS.ACTIVE_ORG_ID] as string,
      updates: { label: body.label, isPrimary: body.isPrimary, contact: body.contact },
    });
    const status = (
      result.success ? HttpStatusCode.OK : (result.statusCode ?? HttpStatusCode.BadRequest)
    ) as ContentfulStatusCode;
    return c.json(result, status);
  });

  // DELETE — Delete contact (org member, officer+)
  app.delete("/api/org-contacts/:id", requireOrg(), requireRole("officer"), async (c) => {
    const result = await handlers.delete.handleAsync({
      id: c.req.param("id"),
      organizationId: c.get("session")![SESSION_FIELDS.ACTIVE_ORG_ID] as string,
    });
    const status = (
      result.success ? HttpStatusCode.OK : (result.statusCode ?? HttpStatusCode.BadRequest)
    ) as ContentfulStatusCode;
    return c.json(result, status);
  });

  // GET — List contacts (org member, any role)
  app.get("/api/org-contacts", requireOrg(), async (c) => {
    const limitParam = parseInt(c.req.query("limit") ?? "", 10);
    const offsetParam = parseInt(c.req.query("offset") ?? "", 10);
    const limit = Math.min(
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const result = await handlers.getByOrg.handleAsync({
      organizationId: c.get("session")![SESSION_FIELDS.ACTIVE_ORG_ID] as string,
      limit,
      offset,
    });
    const status = (
      result.success ? HttpStatusCode.OK : (result.statusCode ?? HttpStatusCode.BadRequest)
    ) as ContentfulStatusCode;
    return c.json(result, status);
  });

  return app;
}
