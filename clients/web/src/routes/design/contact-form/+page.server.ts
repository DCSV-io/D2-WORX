import { superValidate, message } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { error, fail } from "@sveltejs/kit";
import {
  countriesToOptions,
  subdivisionsForCountry,
  type SubdivisionOption,
} from "$lib/forms/geo-ref-data.js";
import { getGeoRefData } from "$lib/server/geo-ref-data.server.js";
import { contactSchema } from "./schema.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  const refData = await getGeoRefData();

  if (!refData) {
    error(503, "Geo reference data unavailable. Ensure infrastructure services are running.");
  }

  const countries = countriesToOptions(refData.countries);

  // Pre-compute subdivisions grouped by country for client-side filtering
  const subdivisionsByCountry: Record<string, SubdivisionOption[]> = {};
  for (const country of countries) {
    if (country.subdivisionCodes.length > 0) {
      subdivisionsByCountry[country.value] = subdivisionsForCountry(
        refData.subdivisions,
        country.value,
      );
    }
  }

  const form = await superValidate(zod(contactSchema));

  return { form, countries, subdivisionsByCountry };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(contactSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // Cross-field validation: postal code vs country
    const { country, postalCode } = form.data;
    if (country && postalCode) {
      try {
        const { postcodeValidator } = await import("postcode-validator");
        if (!postcodeValidator(postalCode, country)) {
          form.errors.postalCode = [`Invalid postal code for ${country}`];
          form.valid = false;
          return fail(400, { form });
        }
      } catch {
        // postcode-validator doesn't support all countries — skip validation
      }
    }

    // Demo: no actual submission — return success message
    return message(form, "Contact form validated successfully!");
  },
};
