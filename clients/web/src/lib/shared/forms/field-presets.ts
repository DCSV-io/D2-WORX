/**
 * Field presets — reusable UI metadata (labels, placeholders, descriptions)
 * for common form fields.
 *
 * Presets are plain data objects that spread into form components.
 * They do NOT contain validation logic (that lives in schemas.ts).
 *
 * Usage:
 *   <FormInput {form} field="firstName" {...FIRST_NAME} />
 *   <FormCombobox {form} field="country" {...COUNTRY} options={countries} />
 */

export interface FieldPreset {
  label: string;
  placeholder: string;
  type?: string;
  description?: string;
}

export interface ComboboxPreset extends FieldPreset {
  searchPlaceholder?: string;
  emptyMessage?: string;
}

// --- Input presets ---

export const FIRST_NAME: FieldPreset = {
  label: "First Name",
  placeholder: "First",
};

export const LAST_NAME: FieldPreset = {
  label: "Last Name",
  placeholder: "Last",
};

export const EMAIL: FieldPreset = {
  label: "Email",
  placeholder: "your@email.com",
  type: "email",
};

export const PHONE: FieldPreset = {
  label: "Phone",
  placeholder: "",
  description: "Include country code for international numbers.",
};

export const STREET1: FieldPreset = {
  label: "Street Address",
  placeholder: "123 Street Rd",
};

export const STREET2: FieldPreset = {
  label: "Address Line 2",
  placeholder: "Apt, suite, unit",
};

export const STREET3: FieldPreset = {
  label: "Address Line 3",
  placeholder: "Building, floor",
};

export const CITY: FieldPreset = {
  label: "City",
  placeholder: "City",
};

export const POSTAL_CODE: FieldPreset = {
  label: "ZIP / Postal Code",
  placeholder: "#####",
  description: "Must match the selected country format.",
};

export const PASSWORD: FieldPreset = {
  label: "Password",
  placeholder: "Enter password",
  type: "password",
};

export const CONFIRM_EMAIL: FieldPreset = {
  label: "Confirm Email",
  placeholder: "Re-enter your email",
  type: "email",
};

export const CONFIRM_PASSWORD: FieldPreset = {
  label: "Confirm Password",
  placeholder: "Re-enter your password",
  type: "password",
};

// --- Combobox presets ---

export const COUNTRY: ComboboxPreset = {
  label: "Country",
  placeholder: "Select a country...",
  searchPlaceholder: "Search countries...",
  emptyMessage: "No country found.",
};

export const STATE: ComboboxPreset = {
  label: "State / Province",
  placeholder: "Select a state...",
  searchPlaceholder: "Search states...",
  emptyMessage: "No state found.",
};
