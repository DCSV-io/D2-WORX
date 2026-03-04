import { z } from "zod";
import { nameField, emailField, phoneField, streetField } from "$lib/forms/schemas.js";

/** The contact form schema — postal code cross-validation happens in the action. */
export const contactSchema = z.object({
  firstName: nameField(),
  lastName: nameField(),
  email: emailField(),
  phone: phoneField(),
  country: z.string().min(1, "Please select a country"),
  state: z.string().optional().default(""),
  street1: streetField(),
  street2: z.string().max(200).optional().default(""),
  city: nameField(),
  postalCode: z.string().min(1, "Required").max(20, "Postal code too long"),
});

export type ContactFormData = z.infer<typeof contactSchema>;
