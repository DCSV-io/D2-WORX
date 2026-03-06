import { z } from "zod";
import { nameField, emailField, passwordField } from "$lib/shared/forms/schemas.js";

/**
 * Signup form schema — exercises email confirmation and password rules.
 *
 * Cross-field rules:
 * - confirmEmail must match email
 * - confirmPassword must match password
 *
 * Password rules mirror auth-domain client-side subset:
 * min 12, max 128, no numeric-only, no date-like.
 */
export function createSignupSchema() {
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

export type SignupFormData = z.infer<ReturnType<typeof createSignupSchema>>;
