import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuth,
  createPasswordFunctions,
  type AuthHooks,
  type AuthServiceConfig,
  type PrefixCache,
} from "@d2/auth-infra";
import { JWT_CLAIM_TYPES } from "@d2/auth-domain";
import {
  startPostgres,
  stopPostgres,
  getPool,
  getDb,
  cleanAllTables,
} from "./postgres-test-helpers.js";

/**
 * Tests the REAL `createAuth()` factory with all 6 plugins (bearer, username,
 * jwt, organization, admin) and hooks (UUIDv7 IDs, org type validation,
 * password validation, session hooks, JWT claims) against real PostgreSQL.
 *
 * This is the highest-value integration test — it catches wiring issues,
 * plugin interactions, and hook behaviors that unit tests can't reach.
 */
describe("createAuth() full integration", () => {
  const testConfig: AuthServiceConfig = {
    databaseUrl: "", // populated by testcontainer
    redisUrl: "",
    baseUrl: "http://localhost:3333",
    corsOrigin: "http://localhost:5173",
    jwtIssuer: "test-issuer",
    jwtAudience: "test-audience",
    jwtExpirationSeconds: 900,
    passwordMinLength: 12,
    passwordMaxLength: 128,
  };

  let auth: ReturnType<typeof createAuth>;
  let onSignInCalls: Array<{ userId: string; ipAddress: string; userAgent: string }>;

  /**
   * Mock HIBP cache — always returns empty response (no breaches found).
   * This avoids network calls while still exercising domain validation
   * (numeric-only, date-like, common blocklist) via createPasswordFunctions.
   */
  const mockHibpCache: PrefixCache = {
    get: () => "",
    set: () => {},
  };

  beforeAll(async () => {
    await startPostgres();

    onSignInCalls = [];

    const passwordFns = createPasswordFunctions(mockHibpCache);

    const hooks: AuthHooks = {
      onSignIn: async (data) => {
        onSignInCalls.push(data);
      },
      passwordFunctions: passwordFns,
    };

    auth = createAuth(testConfig, getDb(), undefined, hooks);
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanAllTables();
    onSignInCalls = [];
  });

  /** Helper: sign up and return user + session token. */
  async function signUp(
    email: string,
    name: string,
    password = "SecurePass123!@#",
  ) {
    const res = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const token = res.token ?? (res as Record<string, unknown>).session?.token;
    return { user: res.user, token: token as string, session: res.session };
  }

  // -----------------------------------------------------------------------
  // UUIDv7 + forceAllowId
  // -----------------------------------------------------------------------
  describe("UUIDv7 ID generation", () => {
    it("should generate UUIDv7 IDs for new users", async () => {
      const { user } = await signUp("uuid@example.com", "UUID User");

      expect(user.id).toBeDefined();
      // UUIDv7 format: 8-4-4-4-12 = 36 chars, version nibble = 7
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("should generate UUIDv7 IDs for organizations", async () => {
      const { token } = await signUp("org-id@example.com", "Org ID User");

      const org = await auth.api.createOrganization({
        body: { name: "Test Org", slug: "test-org" },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      expect(org.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Session hooks (onSignIn callback)
  // -----------------------------------------------------------------------
  describe("session hooks", () => {
    it("should fire onSignIn after sign-up (auto sign-in)", async () => {
      const { user } = await signUp("hook@example.com", "Hook User");

      // Wait a tick for fire-and-forget callback
      await new Promise((r) => setTimeout(r, 100));

      expect(onSignInCalls.length).toBeGreaterThanOrEqual(1);
      const call = onSignInCalls.find((c) => c.userId === user.id);
      expect(call).toBeDefined();
      expect(call!.userId).toBe(user.id);
    });

    it("should fire onSignIn after explicit sign-in", async () => {
      await signUp("signin-hook@example.com", "SignIn Hook");
      onSignInCalls = [];

      await auth.api.signInEmail({
        body: { email: "signin-hook@example.com", password: "SecurePass123!@#" },
      });

      await new Promise((r) => setTimeout(r, 100));

      expect(onSignInCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // JWT claims
  // -----------------------------------------------------------------------
  describe("JWT claims", () => {
    it("should issue a JWT with correct sub, email, name claims", async () => {
      const { token } = await signUp("jwt@example.com", "JWT User");

      const tokenRes = await auth.api.getToken({
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });
      expect(tokenRes.token).toBeDefined();

      // Decode JWT payload (base64url)
      const parts = tokenRes.token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      expect(payload[JWT_CLAIM_TYPES.SUB]).toBeDefined();
      expect(payload[JWT_CLAIM_TYPES.EMAIL]).toBe("jwt@example.com");
      expect(payload[JWT_CLAIM_TYPES.NAME]).toBe("JWT User");
      expect(payload.iss).toBe("test-issuer");
      expect(payload.aud).toBe("test-audience");
    });

    it("should include org context claims when session has active org", async () => {
      const { token } = await signUp("jwt-org@example.com", "JWT Org User");

      const org = await auth.api.createOrganization({
        body: { name: "JWT Org", slug: "jwt-org" },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      await auth.api.setActiveOrganization({
        body: { organizationId: org.id },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      const tokenRes = await auth.api.getToken({
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });
      const parts = tokenRes.token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      expect(payload[JWT_CLAIM_TYPES.ORG_ID]).toBe(org.id);
      // Role in JWT comes from custom session field (populated by app-layer code,
      // not BetterAuth's setActiveOrganization). Verify it's present as a key.
      expect(JWT_CLAIM_TYPES.ROLE in payload).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Organization + orgType
  // -----------------------------------------------------------------------
  describe("organization + orgType", () => {
    it("should create an org with default orgType 'customer'", async () => {
      const { token } = await signUp("org-default@example.com", "Org Default");

      const org = await auth.api.createOrganization({
        body: { name: "Default Org", slug: "default-org" },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      const result = await getPool().query(
        "SELECT org_type FROM organization WHERE id = $1",
        [org.id],
      );
      expect(result.rows[0].org_type).toBe("customer");
    });

    it("should assign creator as owner member", async () => {
      const { user, token } = await signUp("org-owner@example.com", "Org Owner");

      const org = await auth.api.createOrganization({
        body: { name: "Owner Org", slug: "owner-org" },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      const result = await getPool().query(
        "SELECT role FROM member WHERE organization_id = $1 AND user_id = $2",
        [org.id, user.id],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].role).toBe("owner");
    });
  });

  // -----------------------------------------------------------------------
  // Password validation (domain rules via hash hook)
  // -----------------------------------------------------------------------
  describe("password validation", () => {
    it("should reject numeric-only passwords", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            email: "numonly@example.com",
            password: "123456789012",
            name: "Numeric User",
          },
        }),
      ).rejects.toThrow();
    });

    it("should reject common blocklist passwords", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            email: "blocklist@example.com",
            password: "password1234",
            name: "Blocklist User",
          },
        }),
      ).rejects.toThrow();
    });

    it("should accept a valid strong password", async () => {
      const { user } = await signUp(
        "valid-pass@example.com",
        "Valid Pass User",
        "MyStr0ng!P@ssw0rd",
      );

      expect(user).toBeDefined();
      expect(user.email).toBe("valid-pass@example.com");
    });
  });

  // -----------------------------------------------------------------------
  // Custom session fields
  // -----------------------------------------------------------------------
  describe("custom session fields", () => {
    it("should persist active organization in session after setActiveOrganization", async () => {
      const { token } = await signUp("session-fields@example.com", "Session Fields");

      const org = await auth.api.createOrganization({
        body: { name: "Session Org", slug: "session-org" },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      await auth.api.setActiveOrganization({
        body: { organizationId: org.id },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });

      const result = await getPool().query(
        `SELECT active_organization_id FROM session WHERE token = $1`,
        [token],
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].active_organization_id).toBe(org.id);
    });
  });
});
