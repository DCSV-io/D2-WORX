import { z } from "zod";
import { passwordField } from "$lib/shared/forms/schemas.js";

/**
 * Reset password form schema — new password + confirmation.
 *
 * Uses the same password rules as sign-up (min 12, max 128, no numeric-only,
 * no date-like). Server adds HIBP + blocklist checks.
 */
export function createResetPasswordSchema() {
  return z
    .object({
      newPassword: passwordField(),
      confirmNewPassword: z.string().min(1, "Required"),
    })
    .refine((d) => d.newPassword === d.confirmNewPassword, {
      message: "Passwords do not match",
      path: ["confirmNewPassword"],
    });
}

export type ResetPasswordFormData = z.infer<ReturnType<typeof createResetPasswordSchema>>;
