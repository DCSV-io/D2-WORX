import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { organization } from "better-auth/plugins/organization";
import { jwt } from "better-auth/plugins/jwt";
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
  verification as verificationTable,
  jwks as jwksTable,
  organization as organizationTable,
  member as memberTable,
  invitation as invitationTable,
} from "@d2/auth-infra";
import {
  startPostgres,
  stopPostgres,
  getPool,
  getDb,
  cleanAllTables,
} from "./postgres-test-helpers.js";

/**
 * Tests that BetterAuth-managed tables work correctly against real PostgreSQL.
 *
 * Tables are created by the Drizzle migration (run by startPostgres).
 * BetterAuth uses the Drizzle adapter, pointing at the same schema
 * definitions used by the auth-infra package.
 */
describe("BetterAuth tables (integration)", () => {
  let auth: ReturnType<typeof betterAuth>;

  const authConfig = {
    baseURL: "http://localhost:3333",
    basePath: "/api/auth",
    emailAndPassword: { enabled: true, autoSignIn: true },
    plugins: [
      bearer(),
      jwt({
        jwks: {
          keyPairConfig: { alg: "RS256" as const, modulusLength: 2048 },
        },
        jwt: {
          issuer: "test-issuer",
          audience: "test-audience",
          expirationTime: "900s",
        },
      }),
      organization({
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
      }),
    ],
  };

  beforeAll(async () => {
    await startPostgres();

    // BetterAuth uses Drizzle adapter — tables already exist from Drizzle migration
    const schema = {
      user: userTable,
      session: sessionTable,
      account: accountTable,
      verification: verificationTable,
      jwks: jwksTable,
      organization: organizationTable,
      member: memberTable,
      invitation: invitationTable,
    };
    auth = betterAuth({
      ...authConfig,
      database: drizzleAdapter(getDb(), {
        provider: "pg",
        schema,
      }),
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanAllTables();
  });

  /** Helper: sign up and return user + session token. */
  async function signUp(email: string, name: string) {
    const res = await auth.api.signUpEmail({
      body: { email, password: "SecurePass123!", name },
    });
    // BetterAuth returns { user, session, token } or { user, token }
    const token = res.token ?? res.session?.token;
    return { user: res.user, token, session: res.session };
  }

  describe("User + Account", () => {
    it("should sign up a user with email/password", async () => {
      const { user, token } = await signUp("test@example.com", "Test User");

      expect(user).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.id).toBeDefined();
      expect(user.id.length).toBeGreaterThan(0);
      expect(token).toBeDefined();
    });

    it("should enforce email uniqueness", async () => {
      await signUp("dupe@example.com", "First");

      await expect(
        auth.api.signUpEmail({
          body: {
            email: "dupe@example.com",
            password: "OtherPass456!",
            name: "Second",
          },
        }),
      ).rejects.toThrow();
    });

    it("should populate user fields correctly", async () => {
      const { user } = await signUp("fields@example.com", "Field Test");

      expect(user.email).toBe("fields@example.com");
      expect(user.name).toBe("Field Test");
      expect(user.createdAt).toBeDefined();
    });
  });

  describe("Session", () => {
    it("should create a session record on sign-up", async () => {
      const { user } = await signUp("session@example.com", "Session User");

      // Drizzle schema uses snake_case column names in the DB
      const result = await getPool().query(
        `SELECT * FROM session WHERE user_id = $1`,
        [user.id],
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].user_id).toBe(user.id);
      expect(result.rows[0].token).toBeDefined();
      expect(result.rows[0].expires_at).toBeDefined();
    });

    it("should create a new session on sign-in", async () => {
      const { user } = await signUp("signin@example.com", "SignIn User");

      // Sign in again
      await auth.api.signInEmail({
        body: {
          email: "signin@example.com",
          password: "SecurePass123!",
        },
      });

      // Verify multiple sessions exist
      const result = await getPool().query(
        `SELECT * FROM session WHERE user_id = $1`,
        [user.id],
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Organization", () => {
    it("should create an organization", async () => {
      const { token } = await signUp("org-creator@example.com", "Org Creator");

      const org = await auth.api.createOrganization({
        body: {
          name: "Test Org",
          slug: "test-org",
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(org).toBeDefined();
      expect(org.name).toBe("Test Org");
      expect(org.slug).toBe("test-org");
    });

    it("should create a member linking user to org", async () => {
      const { user, token } = await signUp("member-test@example.com", "Member Tester");

      const org = await auth.api.createOrganization({
        body: {
          name: "Member Org",
          slug: "member-org",
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      // Creator is automatically a member — verify via DB query (snake_case columns)
      const result = await getPool().query(
        `SELECT * FROM member WHERE organization_id = $1`,
        [org.id],
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].user_id).toBe(user.id);
    });
  });

  describe("JWKS", () => {
    it("should generate JWKS keys and issue a JWT", async () => {
      const { token } = await signUp("jwks@example.com", "JWKS User");

      // Request a JWT to force JWKS key generation
      const tokenRes = await auth.api.getToken({
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });
      expect(tokenRes.token).toBeDefined();

      // Verify JWKS records exist in database
      const result = await getPool().query("SELECT * FROM jwks");
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
