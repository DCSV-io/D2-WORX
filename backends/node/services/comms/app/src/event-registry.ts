import type { ServiceKey } from "@d2/di";
import type { D2Result } from "@d2/result";
import {
  SendVerificationEmailEventFns,
  SendPasswordResetEventFns,
  SendInvitationEmailEventFns,
} from "@d2/protos";
import {
  IHandleVerificationEmailKey,
  IHandlePasswordResetKey,
  IHandleInvitationEmailKey,
} from "./service-keys.js";

/**
 * Describes a single event type that the auth-event consumer can dispatch.
 *
 * Adding a new auth event requires only adding an entry here and a matching
 * sub-handler + ServiceKey — no consumer or composition root changes needed.
 */
export interface EventRegistration {
  /** Human-readable label for logging. */
  readonly eventType: string;
  /** Returns true if the raw message body matches this event shape. */
  readonly detect: (body: Record<string, unknown>) => boolean;
  /** Proto fromJSON deserializer — turns raw JSON body into a typed event. */
  readonly deserialize: (body: unknown) => unknown;
  /** DI key for the sub-handler that processes this event. */
  readonly handlerKey: ServiceKey<{
    handleAsync(input: never): Promise<D2Result<unknown>>;
  }>;
}

/**
 * Registry of all auth event types the comms consumer can dispatch.
 *
 * Order matters: the first matching entry wins. Keep the most specific
 * detections first (all current detections use unique field names, so
 * order is not actually significant today).
 */
export const AUTH_EVENT_REGISTRY: readonly EventRegistration[] = [
  {
    eventType: "VerificationEmail",
    detect: (body) => "verificationUrl" in body,
    deserialize: (body) => SendVerificationEmailEventFns.fromJSON(body),
    handlerKey: IHandleVerificationEmailKey as unknown as EventRegistration["handlerKey"],
  },
  {
    eventType: "PasswordReset",
    detect: (body) => "resetUrl" in body,
    deserialize: (body) => SendPasswordResetEventFns.fromJSON(body),
    handlerKey: IHandlePasswordResetKey as unknown as EventRegistration["handlerKey"],
  },
  {
    eventType: "InvitationEmail",
    detect: (body) => "invitationUrl" in body,
    deserialize: (body) => SendInvitationEmailEventFns.fromJSON(body),
    handlerKey: IHandleInvitationEmailKey as unknown as EventRegistration["handlerKey"],
  },
];

/**
 * Finds the first matching event registration for the given message body.
 * Returns `null` if no registration matches (unknown event shape).
 */
export function matchEvent(body: Record<string, unknown>): EventRegistration | null {
  for (const reg of AUTH_EVENT_REGISTRY) {
    if (reg.detect(body)) return reg;
  }
  return null;
}
