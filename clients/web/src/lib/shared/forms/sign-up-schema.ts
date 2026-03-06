import { z } from "zod";
import { nameField, emailField, passwordField } from "$lib/shared/forms/schemas.js";

/**
 * Sign-up form schema — real auth integration.
 *
 * Identical validation rules to the demo signup schema:
 * - Cross-field: confirmEmail must match email, confirmPassword must match password
 * - Password: min 12, max 128, no numeric-only, no date-like
 */
export function createSignUpSchema() {
  return z
    .object({
      firstName: nameField(),
      lastName: nameField(),
      email: emailField(),
      confirmEmail: emailField(),
      password: passwordField(),
      confirmPassword: z.string().min(1, "Required"),
    })
    .refine((d) => d.email === d.confirmEmail, {
      message: "Emails do not match",
      path: ["confirmEmail"],
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
}

export type SignUpFormData = z.infer<ReturnType<typeof createSignUpSchema>>;
