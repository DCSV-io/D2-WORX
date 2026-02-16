import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type D2Result, HttpStatusCode } from "@d2/result";
import { SESSION_FIELDS, type OrgType } from "@d2/auth-domain";
import type { SessionVariables } from "../middleware/session.js";
import { requireOrg, requireStaff, requireRole } from "../middleware/authorization.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = { handleAsync: (input: any) => Promise<D2Result<any>> };

interface EmulationHandlers {
  create: Handler;
  revoke: Handler;
  getActive: Handler;
}

/** Default and maximum page sizes for list endpoints. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Thin routes for emulation consent management.
 * Authorization is visible at route declaration via middleware.
 * All validation and business logic lives in handlers.
 */
export function createEmulationRoutes(handlers: EmulationHandlers) {
  const app = new Hono<{ Variables: SessionVariables }>();

  // POST — Create consent (staff officer+)
  app.post(
    "/api/emulation/consent",
    requireOrg(),
    requireStaff(),
    requireRole("officer"),
    async (c) => {
      const body = await c.req.json();
      const result = await handlers.create.handleAsync({
        userId: c.get("user")!.id,
        grantedToOrgId: body.grantedToOrgId,
        activeOrgType: c.get("session")![SESSION_FIELDS.ACTIVE_ORG_TYPE] as OrgType,
        expiresAt: new Date(body.expiresAt),
      });
      const status = (
        result.success ? HttpStatusCode.Created : (result.statusCode ?? HttpStatusCode.BadRequest)
      ) as ContentfulStatusCode;
      return c.json(result, status);
    },
  );

  // DELETE — Revoke consent (staff officer+)
  app.delete(
    "/api/emulation/consent/:id",
    requireOrg(),
    requireStaff(),
    requireRole("officer"),
    async (c) => {
      const result = await handlers.revoke.handleAsync({
        consentId: c.req.param("id"),
        userId: c.get("user")!.id,
      });
      const status = (
        result.success ? HttpStatusCode.OK : (result.statusCode ?? HttpStatusCode.BadRequest)
      ) as ContentfulStatusCode;
      return c.json(result, status);
    },
  );

  // GET — List active consents (staff, any role)
  app.get("/api/emulation/consent", requireOrg(), requireStaff(), async (c) => {
    const limitParam = parseInt(c.req.query("limit") ?? "", 10);
    const offsetParam = parseInt(c.req.query("offset") ?? "", 10);
    const limit = Math.min(
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const result = await handlers.getActive.handleAsync({
      userId: c.get("user")!.id,
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
