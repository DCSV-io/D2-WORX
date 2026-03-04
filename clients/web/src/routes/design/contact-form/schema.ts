import { z } from "zod";
import { nameField, emailField, phoneField, streetField } from "$lib/forms/schemas.js";

/**
 * Contact form schema — matches Geo proto StreetAddressDTO shape.
 *
 * Cross-field rules:
 * - street3 requires street2 (line_3 requires line_2)
 * - street2 requires street1 (line_2 requires line_1)
 * - Postal code vs country validation happens in the server action.
 */
export const contactSchema = z
  .object({
    firstName: nameField(),
    lastName: nameField(),
    email: emailField(),
    phone: phoneField(),
    country: z.string().trim().min(1, "Please select a country"),
    state: z.string().optional().default(""),
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
  });

export type ContactFormData = z.infer<typeof contactSchema>;
