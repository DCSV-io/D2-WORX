import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import type { SecondaryStorage } from "better-auth";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { JWT_CLAIM_TYPES, SESSION_FIELDS } from "@d2/auth-domain";
import type { AuthServiceConfig } from "./auth-config.js";
import { AUTH_CONFIG_DEFAULTS } from "./auth-config.js";
import { generateId } from "./hooks/id-hooks.js";
import { beforeCreateOrganization } from "./hooks/org-hooks.js";
import {
  ac,
  ownerPermissions,
  officerPermissions,
  agentPermissions,
  auditorPermissions,
} from "./access-control.js";
import * as betterAuthSchema from "../../repository/schema/better-auth-tables.js";

/**
 * Callback interface for app-layer hooks.
 *
 * The auth-infra package does not import from auth-app. Instead,
 * the API layer (composition root) provides these callbacks when
 * creating the BetterAuth instance, enabling auth-infra to trigger
 * app-layer logic without a circular dependency.
 */
export interface AuthHooks {
  /** Called after a successful sign-in to record audit events. */
  onSignIn?: (data: { userId: string; ipAddress: string; userAgent: string }) => Promise<void>;
  /**
   * Returns the client fingerprint for the current request.
   * Used by `definePayload` to embed an `fp` claim in JWTs, enabling
   * gateway-side validation that the JWT is being used by the same client.
   * Typically backed by `AsyncLocalStorage` in the composition root.
   */
  getFingerprintForCurrentRequest?: () => string | undefined;
  /**
   * Custom password hash/verify functions with domain validation + HIBP checks.
   * Created by `createPasswordFunctions()` in the composition root.
   */
  passwordFunctions?: {
    hash: (password: string) => Promise<string>;
    verify: (data: { hash: string; password: string }) => Promise<boolean>;
  };
}

/**
 * Creates a fully configured BetterAuth instance.
 *
 * This is the single place where BetterAuth is configured with all
 * plugins, hooks, and session settings. The returned auth instance
 * is used by the API layer to handle requests.
 *
 * @param config - Auth service configuration
 * @param db - Drizzle database instance (owned by the composition root)
 * @param secondaryStorage - Optional Redis-backed secondary storage
 * @param hooks - Optional app-layer callbacks for cross-layer events
 */
export function createAuth(
  config: AuthServiceConfig,
  db: NodePgDatabase,
  secondaryStorage?: SecondaryStorage,
  hooks?: AuthHooks,
) {
  const sessionExpiresIn = config.sessionExpiresIn ?? AUTH_CONFIG_DEFAULTS.sessionExpiresIn;
  const sessionUpdateAge = config.sessionUpdateAge ?? AUTH_CONFIG_DEFAULTS.sessionUpdateAge;
  const cookieCacheMaxAge = config.cookieCacheMaxAge ?? AUTH_CONFIG_DEFAULTS.cookieCacheMaxAge;
  const jwtExpirationSeconds =
    config.jwtExpirationSeconds ?? AUTH_CONFIG_DEFAULTS.jwtExpirationSeconds;
  const jwksRotationDays = config.jwksRotationDays ?? AUTH_CONFIG_DEFAULTS.jwksRotationDays;

  const auth = betterAuth({
    baseURL: config.baseUrl,
    basePath: "/api/auth",

    database: drizzleAdapter(db, {
      provider: "pg",
      schema: betterAuthSchema,
    }),

    secondaryStorage,

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: config.passwordMinLength ?? AUTH_CONFIG_DEFAULTS.passwordMinLength,
      maxPasswordLength: config.passwordMaxLength ?? AUTH_CONFIG_DEFAULTS.passwordMaxLength,
      password: hooks?.passwordFunctions,
    },

    session: {
      expiresIn: sessionExpiresIn,
      updateAge: sessionUpdateAge,
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: cookieCacheMaxAge,
        strategy: "compact",
      },
      additionalFields: {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: {
          type: "string",
          required: false,
          input: false,
        },
        [SESSION_FIELDS.ACTIVE_ORG_ROLE]: {
          type: "string",
          required: false,
          input: false,
        },
        [SESSION_FIELDS.EMULATED_ORG_ID]: {
          type: "string",
          required: false,
          input: false,
        },
        [SESSION_FIELDS.EMULATED_ORG_TYPE]: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },

    advanced: {
      database: {
        generateId,
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Ensure pre-generated IDs are preserved (forceAllowId pattern)
            if (user.id) {
              return { data: { ...user, id: user.id } };
            }
            return { data: user };
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            // Record sign-in event via app-layer callback
            if (hooks?.onSignIn) {
              const ipAddress = (session["ipAddress"] as string) ?? "unknown";
              const userAgent = (session["userAgent"] as string) ?? "unknown";
              const userId = session["userId"] as string;

              if (userId) {
                // Fire-and-forget — don't block session creation
                hooks.onSignIn({ userId, ipAddress, userAgent }).catch(() => {
                  // Swallow errors — sign-in audit is non-critical
                });
              }
            }
          },
        },
      },
    },

    trustedOrigins: [config.corsOrigin],

    plugins: [
      bearer(),
      jwt({
        jwks: {
          keyPairConfig: {
            alg: "RS256",
            modulusLength: 2048,
          },
          rotationInterval: jwksRotationDays * 24 * 60 * 60,
          gracePeriod: 30 * 24 * 60 * 60, // 30 days
        },
        jwt: {
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
          expirationTime: `${jwtExpirationSeconds}s`,
          definePayload: async ({ user, session }) => {
            const s = session as Record<string, unknown>;
            return {
              [JWT_CLAIM_TYPES.SUB]: user.id,
              [JWT_CLAIM_TYPES.EMAIL]: user.email,
              [JWT_CLAIM_TYPES.NAME]: user.name,
              [JWT_CLAIM_TYPES.ORG_ID]: s[SESSION_FIELDS.ACTIVE_ORG_ID] ?? null,
              [JWT_CLAIM_TYPES.ORG_TYPE]: s[SESSION_FIELDS.ACTIVE_ORG_TYPE] ?? null,
              [JWT_CLAIM_TYPES.ROLE]: s[SESSION_FIELDS.ACTIVE_ORG_ROLE] ?? null,
              [JWT_CLAIM_TYPES.EMULATED_ORG_ID]: s[SESSION_FIELDS.EMULATED_ORG_ID] ?? null,
              [JWT_CLAIM_TYPES.IS_EMULATING]: !!s[SESSION_FIELDS.EMULATED_ORG_ID],
              [JWT_CLAIM_TYPES.IMPERSONATED_BY]: (s["impersonatedBy"] as string) ?? null,
              [JWT_CLAIM_TYPES.IS_IMPERSONATING]: !!(s["impersonatedBy"] as string),
              [JWT_CLAIM_TYPES.FINGERPRINT]: hooks?.getFingerprintForCurrentRequest?.() ?? null,
            };
          },
        },
      }),
      organization({
        ac,
        roles: {
          owner: ownerPermissions,
          officer: officerPermissions,
          agent: agentPermissions,
          auditor: auditorPermissions,
        },
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        invitationExpiresIn: 48 * 60 * 60, // 48 hours
        schema: {
          organization: {
            additionalFields: {
              orgType: {
                type: "string",
                required: false,
                defaultValue: "customer",
                input: false,
              },
            },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async (data) => {
            beforeCreateOrganization(data.organization as Record<string, unknown>);
          },
        },
      }),
      admin({
        defaultRole: "agent",
        impersonationSessionDuration: 60 * 60, // 1 hour
      }),
    ],
  });

  return auth;
}

/** The return type of createAuth — use this to type the auth instance. */
export type Auth = ReturnType<typeof createAuth>;
