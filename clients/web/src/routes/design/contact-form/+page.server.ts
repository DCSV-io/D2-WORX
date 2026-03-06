import { superValidate, message } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { error, fail } from "@sveltejs/kit";
import {
  countriesToOptions,
  subdivisionsForCountry,
  buildCountriesWithSubdivisions,
  type SubdivisionOption,
} from "$lib/shared/forms/geo-ref-data.js";
import { getGeoRefData } from "$lib/server/geo-ref-data.server.js";
import { createContactSchema } from "./schema.js";
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

  const countriesWithSubdivisions = buildCountriesWithSubdivisions(subdivisionsByCountry);
  const schema = createContactSchema(countriesWithSubdivisions);
  const form = await superValidate(zod(schema));

  return {
    form,
    countries,
    subdivisionsByCountry,
    countriesWithSubdivisions: [...countriesWithSubdivisions],
  };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const refData = await getGeoRefData();
    const countries = refData ? countriesToOptions(refData.countries) : [];

    const subdivisionsByCountry: Record<string, SubdivisionOption[]> = {};
    for (const country of countries) {
      if (country.subdivisionCodes.length > 0 && refData) {
        subdivisionsByCountry[country.value] = subdivisionsForCountry(
          refData.subdivisions,
          country.value,
        );
      }
    }

    const countriesWithSubdivisions = buildCountriesWithSubdivisions(subdivisionsByCountry);
    const schema = createContactSchema(countriesWithSubdivisions);
    const form = await superValidate(request, zod(schema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // Demo: no actual submission — return success message
    return message(form, "Contact form validated successfully!");
  },
};
