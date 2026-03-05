import { z } from "zod";
import { postcodeValidator } from "postcode-validator";
import { nameField, emailField, phoneField, streetField } from "$lib/forms/schemas.js";

/**
 * Contact form schema factory — matches Geo proto StreetAddressDTO shape.
 *
 * Cross-field rules:
 * - street3 requires street2 (line_3 requires line_2)
 * - street2 requires street1 (line_2 requires line_1)
 * - State required when country has subdivisions
 * - Postal code validated against country format
 *
 * @param countriesWithSubdivisions - Set of ISO alpha-2 codes that have subdivisions.
 */
export function createContactSchema(countriesWithSubdivisions: Set<string>) {
  return z
    .object({
      firstName: nameField(),
      lastName: nameField(),
      email: emailField(),
      phone: phoneField(),
      country: z.string().trim().min(1, "Please select a country"),
      state: z.string().trim().optional().default(""),
      street1: streetField(),
      street2: z.string().trim().max(200).optional().default(""),
      street3: z.string().trim().max(200).optional().default(""),
      city: nameField(),
      postalCode: z.string().trim().min(1, "Required").max(20, "Postal code too long"),
    })
    .refine((d) => !d.street3 || d.street2, {
      message: "Address Line 2 is required when Line 3 is provided",
      path: ["street2"],
    })
    .refine((d) => !d.street2 || d.street1, {
      message: "Street Address is required when additional lines are provided",
      path: ["street1"],
    })
    .superRefine((d, ctx) => {
      // State required when country has subdivisions
      if (d.country && countriesWithSubdivisions.has(d.country) && !d.state?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state"],
          message: "State / Province is required for this country",
        });
      }

      // Postal code vs country format
      if (d.country && d.postalCode) {
        try {
          if (!postcodeValidator(d.postalCode, d.country)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["postalCode"],
              message: `Invalid postal code for ${d.country}`,
            });
          }
        } catch {
          // postcode-validator doesn't support all countries — skip validation
        }
      }
    });
}

export type ContactFormData = z.infer<ReturnType<typeof createContactSchema>>;
