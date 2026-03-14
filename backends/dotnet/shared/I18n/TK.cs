// -----------------------------------------------------------------------
// <copyright file="TK.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.I18n;

/// <summary>
/// Translation Key constants organized by domain and category.
/// Key values match the JSON keys in <c>contracts/messages/*.json</c>.
/// </summary>
public static class TK
{
    /// <summary>
    /// Common (cross-cutting) translation keys.
    /// </summary>
    public static class Common
    {
        /// <summary>
        /// Error message keys shared across all services.
        /// </summary>
        public static class Errors
        {
            /// <summary>The request was malformed or invalid.</summary>
            public const string BAD_REQUEST = "common_errors_BAD_REQUEST";

            /// <summary>The requested resource was not found.</summary>
            public const string NOT_FOUND = "common_errors_NOT_FOUND";

            /// <summary>The caller is not authorized to perform this action.</summary>
            public const string UNAUTHORIZED = "common_errors_UNAUTHORIZED";

            /// <summary>Access to the resource is forbidden.</summary>
            public const string FORBIDDEN = "common_errors_FORBIDDEN";

            /// <summary>A conflict occurred with the current state.</summary>
            public const string CONFLICT = "common_errors_CONFLICT";

            /// <summary>The caller has exceeded the request rate limit.</summary>
            public const string TOO_MANY_REQUESTS = "common_errors_TOO_MANY_REQUESTS";

            /// <summary>The request could not be completed.</summary>
            public const string REQUEST_FAILED = "common_errors_REQUEST_FAILED";

            /// <summary>Input validation failed.</summary>
            public const string VALIDATION_FAILED = "common_errors_VALIDATION_FAILED";

            /// <summary>An unknown or unhandled error occurred.</summary>
            public const string UNKNOWN = "common_errors_unknown";
        }
    }

    /// <summary>
    /// Geo service translation keys.
    /// </summary>
    public static class Geo
    {
        /// <summary>
        /// Input validation error messages for geo-related operations.
        /// </summary>
        public static class Validation
        {
            /// <summary>IP address is required.</summary>
            public const string IP_REQUIRED = "geo_validation_ip_required";

            /// <summary>IP address format is invalid.</summary>
            public const string IP_INVALID = "geo_validation_ip_invalid";

            /// <summary>Month value is out of valid range (1-12).</summary>
            public const string MONTH_RANGE = "geo_validation_month_range";

            /// <summary>Year value is out of valid range.</summary>
            public const string YEAR_RANGE = "geo_validation_year_range";

            /// <summary>Latitude value is out of valid range (-90 to 90).</summary>
            public const string LATITUDE_RANGE = "geo_validation_latitude_range";

            /// <summary>Longitude value is out of valid range (-180 to 180).</summary>
            public const string LONGITUDE_RANGE = "geo_validation_longitude_range";

            /// <summary>Address line 1 is required.</summary>
            public const string ADDRESS_LINE1_REQUIRED = "geo_validation_address_line1_required";

            /// <summary>Address line 2 is required.</summary>
            public const string ADDRESS_LINE2_REQUIRED = "geo_validation_address_line2_required";

            /// <summary>Context key is required.</summary>
            public const string CONTEXT_KEY_REQUIRED = "geo_validation_context_key_required";

            /// <summary>Related entity ID is required.</summary>
            public const string RELATED_ENTITY_ID_REQUIRED = "geo_validation_related_entity_id_required";

            /// <summary>First name is required.</summary>
            public const string FIRST_NAME_REQUIRED = "geo_validation_first_name_required";

            /// <summary>Company name is required.</summary>
            public const string COMPANY_NAME_REQUIRED = "geo_validation_company_name_required";

            /// <summary>Email address is required.</summary>
            public const string EMAIL_REQUIRED = "geo_validation_email_required";

            /// <summary>Phone number is required.</summary>
            public const string PHONE_REQUIRED = "geo_validation_phone_required";
        }
    }
}
