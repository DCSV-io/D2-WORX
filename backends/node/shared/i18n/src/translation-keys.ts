/**
 * Translation key constants. Mirrors D2.Shared.I18n.TK in .NET.
 * Usage: TK.common.errors.NOT_FOUND
 */
export const TK = {
  common: {
    errors: {
      BAD_REQUEST: "common_errors_BAD_REQUEST",
      NOT_FOUND: "common_errors_NOT_FOUND",
      UNAUTHORIZED: "common_errors_UNAUTHORIZED",
      FORBIDDEN: "common_errors_FORBIDDEN",
      CONFLICT: "common_errors_CONFLICT",
      REQUEST_FAILED: "common_errors_REQUEST_FAILED",
      TOO_MANY_REQUESTS: "common_errors_TOO_MANY_REQUESTS",
      VALIDATION_FAILED: "common_errors_VALIDATION_FAILED",
      UNKNOWN: "common_errors_unknown",
    },
  },
  geo: {
    validation: {
      ipRequired: "geo_validation_ip_required",
      ipInvalid: "geo_validation_ip_invalid",
      monthRange: "geo_validation_month_range",
      yearRange: "geo_validation_year_range",
      latitudeRange: "geo_validation_latitude_range",
      longitudeRange: "geo_validation_longitude_range",
      addressLine1Required: "geo_validation_address_line1_required",
      addressLine2Required: "geo_validation_address_line2_required",
      contextKeyRequired: "geo_validation_context_key_required",
      relatedEntityIdRequired: "geo_validation_related_entity_id_required",
      firstNameRequired: "geo_validation_first_name_required",
      companyNameRequired: "geo_validation_company_name_required",
      emailRequired: "geo_validation_email_required",
      phoneRequired: "geo_validation_phone_required",
    },
  },
} as const;
