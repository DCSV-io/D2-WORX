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
  async function signUp(email: string, name: string, password = "SecurePass123!@#") {
    const res = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const token = res.token ?? (res as Record<string, unknown>).session?.token;
    return { user: res.user, token: token as string, session: res.session };
  }

  // -----------------------------------------------------------------------
  // Full sign-up flow (end-to-end)
  // -----------------------------------------------------------------------
  describe("full sign-up flow", () => {
    it("should create user, account, session, and valid JWT in one sign-up", async () => {
      const { user, token } = await signUp("e2e@example.com", "E2E User");

      // ---- 1. User row — every column populated correctly ----
      const userRow = await getPool().query('SELECT * FROM "user" WHERE id = $1', [user.id]);
      expect(userRow.rows).toHaveLength(1);
      const u = userRow.rows[0];

      expect(u.id).toBe(user.id);
      expect(u.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(u.email).toBe("e2e@example.com");
      expect(u.name).toBe("E2E User");
      expect(u.email_verified).toBe(false);
      expect(u.created_at).toBeInstanceOf(Date);
      expect(u.updated_at).toBeInstanceOf(Date);
      expect(u.image).toBeNull();
      expect(u.role).toBe("agent");
      expect(u.banned).toBe(false);
      expect(u.ban_reason).toBeNull();
      expect(u.ban_expires).toBeNull();

      // Username — auto-generated, lowercase, PascalCase display variant
      expect(u.username).toBeDefined();
      expect(u.username).toBe(u.username.toLowerCase());
      expect(u.display_username).toBeDefined();
      expect(u.username).toBe(u.display_username.toLowerCase());
      expect(u.display_username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{1,3}$/);

      // ---- 2. Account row — credential provider linked ----
      const accountRow = await getPool().query("SELECT * FROM account WHERE user_id = $1", [
        user.id,
      ]);
      expect(accountRow.rows).toHaveLength(1);
      const acct = accountRow.rows[0];

      expect(acct.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(acct.provider_id).toBe("credential");
      expect(acct.user_id).toBe(user.id);
      expect(acct.password).toBeDefined();
      expect(acct.password.length).toBeGreaterThan(0);
      expect(acct.created_at).toBeInstanceOf(Date);

      // ---- 3. Session row — created by autoSignIn ----
      const sessionRow = await getPool().query(
        "SELECT * FROM session WHERE user_id = $1 AND token = $2",
        [user.id, token],
      );
      expect(sessionRow.rows).toHaveLength(1);
      const sess = sessionRow.rows[0];

      expect(sess.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(sess.user_id).toBe(user.id);
      expect(sess.token).toBe(token);
      expect(sess.expires_at).toBeInstanceOf(Date);
      expect(sess.created_at).toBeInstanceOf(Date);

      // ---- 4. JWT — all claims present and correct ----
      const tokenRes = await auth.api.getToken({
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });
      expect(tokenRes.token).toBeDefined();

      const parts = tokenRes.token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      // Standard JWT fields
      expect(payload.iss).toBe("test-issuer");
      expect(payload.aud).toBe("test-audience");
      expect(payload.iat).toEqual(expect.any(Number));
      expect(payload.exp).toEqual(expect.any(Number));
      expect(payload.exp - payload.iat).toBe(900); // 15-minute expiry

      // Identity claims — match DB values
      expect(payload[JWT_CLAIM_TYPES.SUB]).toBe(user.id);
      expect(payload[JWT_CLAIM_TYPES.EMAIL]).toBe("e2e@example.com");
      expect(payload[JWT_CLAIM_TYPES.USERNAME]).toBe(u.username);

      // Org claims — null (no org set)
      expect(payload[JWT_CLAIM_TYPES.ORG_ID]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.ORG_TYPE]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.ROLE]).toBeNull();

      // Emulation — inactive
      expect(payload[JWT_CLAIM_TYPES.EMULATED_ORG_ID]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.IS_EMULATING]).toBe(false);

      // Impersonation — inactive
      expect(payload[JWT_CLAIM_TYPES.IMPERSONATED_BY]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.IS_IMPERSONATING]).toBe(false);
      expect(payload[JWT_CLAIM_TYPES.IMPERSONATING_EMAIL]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.IMPERSONATING_USERNAME]).toBeNull();

      // Fingerprint — null (no hook provided in test)
      expect(payload[JWT_CLAIM_TYPES.FINGERPRINT]).toBeNull();

      // ---- 5. onSignIn hook — fired by autoSignIn ----
      await new Promise((r) => setTimeout(r, 100));
      const signInCall = onSignInCalls.find((c) => c.userId === user.id);
      expect(signInCall).toBeDefined();
      expect(signInCall!.userId).toBe(user.id);
    });
  });

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
  // User row completeness after sign-up
  // -----------------------------------------------------------------------
  describe("user row completeness", () => {
    it("should populate all user columns correctly after sign-up", async () => {
      const { user } = await signUp("complete@example.com", "Complete User");

      const result = await getPool().query('SELECT * FROM "user" WHERE id = $1', [user.id]);
      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];

      // Identity
      expect(row.id).toBe(user.id);
      expect(row.email).toBe("complete@example.com");
      expect(row.name).toBe("Complete User");

      // Username — auto-generated, lowercase, matches displayUsername case-insensitively
      expect(row.username).toBeDefined();
      expect(row.username).toBe(row.username.toLowerCase());
      expect(row.display_username).toBeDefined();
      expect(row.username).toBe(row.display_username.toLowerCase());

      // displayUsername format: PascalCase adjective + PascalCase noun + 1-3 digit suffix
      expect(row.display_username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{1,3}$/);

      // Email verification
      expect(row.email_verified).toBe(false);

      // Timestamps
      expect(row.created_at).toBeInstanceOf(Date);
      expect(row.updated_at).toBeInstanceOf(Date);

      // Admin plugin fields — defaultRole is "agent" (from admin() plugin config)
      expect(row.role).toBe("agent");
      expect(row.banned).toBe(false);
      expect(row.ban_reason).toBeNull();
      expect(row.ban_expires).toBeNull();

      // Optional fields
      expect(row.image).toBeNull();
    });

    it("should generate unique usernames for different users", async () => {
      const { user: user1 } = await signUp("unique-user1@example.com", "Unique One");
      const { user: user2 } = await signUp("unique-user2@example.com", "Unique Two");

      const result = await getPool().query(
        'SELECT username, display_username FROM "user" WHERE id IN ($1, $2)',
        [user1.id, user2.id],
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].username).not.toBe(result.rows[1].username);
      expect(result.rows[0].display_username).not.toBe(result.rows[1].display_username);
    });
  });

  // -----------------------------------------------------------------------
  // JWT claims
  // -----------------------------------------------------------------------
  describe("JWT claims", () => {
    it("should issue a JWT with all identity claims populated", async () => {
      const { user, token } = await signUp("jwt@example.com", "JWT User");

      // Fetch the auto-generated username from DB for assertion
      const dbRow = await getPool().query('SELECT username FROM "user" WHERE id = $1', [user.id]);
      const dbUsername = dbRow.rows[0].username as string;

      const tokenRes = await auth.api.getToken({
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      });
      expect(tokenRes.token).toBeDefined();

      // Decode JWT payload (base64url)
      const parts = tokenRes.token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      // Standard JWT fields
      expect(payload.iss).toBe("test-issuer");
      expect(payload.aud).toBe("test-audience");
      expect(payload.iat).toEqual(expect.any(Number));
      expect(payload.exp).toEqual(expect.any(Number));

      // Identity claims — all must be present and correct
      expect(payload[JWT_CLAIM_TYPES.SUB]).toBe(user.id);
      expect(payload[JWT_CLAIM_TYPES.EMAIL]).toBe("jwt@example.com");
      expect(payload[JWT_CLAIM_TYPES.USERNAME]).toBe(dbUsername);

      // Org claims — null when no active org
      expect(payload[JWT_CLAIM_TYPES.ORG_ID]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.ORG_TYPE]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.ROLE]).toBeNull();

      // Emulation claims — inactive
      expect(payload[JWT_CLAIM_TYPES.EMULATED_ORG_ID]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.IS_EMULATING]).toBe(false);

      // Impersonation claims — inactive
      expect(payload[JWT_CLAIM_TYPES.IMPERSONATED_BY]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.IS_IMPERSONATING]).toBe(false);
      expect(payload[JWT_CLAIM_TYPES.IMPERSONATING_EMAIL]).toBeNull();
      expect(payload[JWT_CLAIM_TYPES.IMPERSONATING_USERNAME]).toBeNull();

      // Fingerprint — null (no getFingerprintForCurrentRequest hook in test)
      expect(payload[JWT_CLAIM_TYPES.FINGERPRINT]).toBeNull();
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

      const result = await getPool().query("SELECT org_type FROM organization WHERE id = $1", [
        org.id,
      ]);
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
