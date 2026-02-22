import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { username } from "better-auth/plugins/username";
import type { SecondaryStorage } from "better-auth";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { JWT_CLAIM_TYPES, SESSION_FIELDS } from "@d2/auth-domain";
import type { AuthServiceConfig } from "./auth-config.js";
import { AUTH_CONFIG_DEFAULTS } from "./auth-config.js";
import { generateId } from "./hooks/id-hooks.js";
import { beforeCreateOrganization } from "./hooks/org-hooks.js";
import { ensureUsername } from "./hooks/username-hooks.js";
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
  /**
   * Publishes a verification email event to RabbitMQ for the comms service.
   * Called by BetterAuth's `emailVerification.sendVerificationEmail` callback.
   */
  publishVerificationEmail?: (input: {
    userId: string;
    email: string;
    name: string;
    verificationUrl: string;
    token: string;
  }) => Promise<void>;
  /**
   * Publishes a password reset email event to RabbitMQ for the comms service.
   * Called by BetterAuth's `emailAndPassword.sendResetPassword` callback.
   */
  publishPasswordReset?: (input: {
    userId: string;
    email: string;
    name: string;
    resetUrl: string;
    token: string;
  }) => Promise<void>;
  /**
   * Creates a Geo contact for a newly registered user.
   * Called in databaseHooks.user.create.before (Contact BEFORE User pattern).
   * If this throws, sign-up fails entirely (fail-fast — no stale users).
   */
  createUserContact?: (data: { userId: string; email: string; name: string }) => Promise<void>;
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
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: config.passwordMinLength ?? AUTH_CONFIG_DEFAULTS.passwordMinLength,
      maxPasswordLength: config.passwordMaxLength ?? AUTH_CONFIG_DEFAULTS.passwordMaxLength,
      password: hooks?.passwordFunctions,
      sendResetPassword: hooks?.publishPasswordReset
        ? async ({ user, url, token }) => {
            await hooks.publishPasswordReset!({
              userId: user.id,
              email: user.email,
              name: user.name ?? "User",
              resetUrl: url,
              token,
            });
          }
        : undefined,
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: hooks?.publishVerificationEmail
        ? async ({ user, url, token }) => {
            await hooks.publishVerificationEmail!({
              userId: user.id,
              email: user.email,
              name: user.name ?? "User",
              verificationUrl: url,
              token,
            });
          }
        : undefined,
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
      cookieOptions: {
        sameSite: "lax",
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
            // Ensure username fields are populated before persistence
            let data = ensureUsername(user as Record<string, unknown>);

            // Ensure pre-generated IDs are preserved (forceAllowId pattern).
            // When no ID is pre-set, generate one so the Geo contact gets a stable userId.
            const userId = (user.id as string) ?? generateId();
            data = { ...data, id: userId };

            // Create Geo contact BEFORE user (fail-fast if Geo unavailable)
            if (hooks?.createUserContact) {
              await hooks.createUserContact({
                userId,
                email: user.email as string,
                name: (user.name as string) ?? "",
              });
            }

            return { data };
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
      username(),
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
            const u = user as Record<string, unknown>;

            // Resolve impersonator details if impersonation is active
            let impersonatingEmail: string | null = null;
            let impersonatingUsername: string | null = null;
            const impersonatedBy = (s["impersonatedBy"] as string) ?? null;

            if (impersonatedBy) {
              try {
                const impersonator = await db
                  .select({
                    email: betterAuthSchema.user.email,
                    username: betterAuthSchema.user.username,
                  })
                  .from(betterAuthSchema.user)
                  .where(eq(betterAuthSchema.user.id, impersonatedBy))
                  .limit(1);
                const imp = impersonator[0];
                if (imp) {
                  impersonatingEmail = imp.email;
                  impersonatingUsername = imp.username;
                }
              } catch {
                // Non-critical — impersonator details are for audit only
              }
            }

            return {
              [JWT_CLAIM_TYPES.SUB]: user.id,
              [JWT_CLAIM_TYPES.EMAIL]: user.email,
              [JWT_CLAIM_TYPES.USERNAME]: (u["username"] as string) ?? null,
              [JWT_CLAIM_TYPES.ORG_ID]: s[SESSION_FIELDS.ACTIVE_ORG_ID] ?? null,
              [JWT_CLAIM_TYPES.ORG_TYPE]: s[SESSION_FIELDS.ACTIVE_ORG_TYPE] ?? null,
              [JWT_CLAIM_TYPES.ROLE]: s[SESSION_FIELDS.ACTIVE_ORG_ROLE] ?? null,
              [JWT_CLAIM_TYPES.EMULATED_ORG_ID]: s[SESSION_FIELDS.EMULATED_ORG_ID] ?? null,
              [JWT_CLAIM_TYPES.IS_EMULATING]: !!s[SESSION_FIELDS.EMULATED_ORG_ID],
              [JWT_CLAIM_TYPES.IMPERSONATED_BY]: impersonatedBy,
              [JWT_CLAIM_TYPES.IS_IMPERSONATING]: !!impersonatedBy,
              [JWT_CLAIM_TYPES.IMPERSONATING_EMAIL]: impersonatingEmail,
              [JWT_CLAIM_TYPES.IMPERSONATING_USERNAME]: impersonatingUsername,
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
