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

            /// <summary>The service is temporarily unavailable.</summary>
            public const string SERVICE_UNAVAILABLE = "common_errors_SERVICE_UNAVAILABLE";

            /// <summary>The request payload is too large.</summary>
            public const string PAYLOAD_TOO_LARGE = "common_errors_PAYLOAD_TOO_LARGE";

            /// <summary>The operation was cancelled.</summary>
            public const string CANCELLED = "common_errors_CANCELLED";

            /// <summary>An unknown or unhandled error occurred.</summary>
            public const string UNKNOWN = "common_errors_unknown";

            /// <summary>Value could not be serialized.</summary>
            public const string COULD_NOT_BE_SERIALIZED = "common_errors_COULD_NOT_BE_SERIALIZED";

            /// <summary>Value could not be deserialized.</summary>
            public const string COULD_NOT_BE_DESERIALIZED = "common_errors_COULD_NOT_BE_DESERIALIZED";
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

            /// <summary>The ID must be a valid, non-empty GUID.</summary>
            public const string ID_INVALID = "geo_validation_id_invalid";

            /// <summary>Duplicate external keys are not allowed.</summary>
            public const string DUPLICATE_EXT_KEYS = "geo_validation_duplicate_ext_keys";
        }

        /// <summary>
        /// Geo service error message keys.
        /// </summary>
        public static class Errors
        {
            /// <summary>Corrupted data on disk.</summary>
            public const string CORRUPTED_DATA_ON_DISK = "geo_errors_corrupted_data_on_disk";

            /// <summary>Unable to read from disk.</summary>
            public const string DISK_READ_FAILED = "geo_errors_disk_read_failed";

            /// <summary>Unable to write to disk.</summary>
            public const string DISK_WRITE_FAILED = "geo_errors_disk_write_failed";
        }
    }

    /// <summary>
    /// Auth service translation keys.
    /// </summary>
    public static class Auth
    {
        /// <summary>
        /// Auth-specific error messages.
        /// </summary>
        public static class Errors
        {
            /// <summary>This email is already taken.</summary>
            public const string EMAIL_ALREADY_TAKEN = "auth_errors_EMAIL_ALREADY_TAKEN";

            /// <summary>Email query parameter is required.</summary>
            public const string EMAIL_QUERY_REQUIRED = "auth_errors_EMAIL_QUERY_REQUIRED";

            /// <summary>Email is required.</summary>
            public const string EMAIL_REQUIRED = "auth_errors_EMAIL_REQUIRED";

            /// <summary>An active emulation consent already exists for this organization.</summary>
            public const string EMULATION_CONSENT_ALREADY_EXISTS = "auth_errors_EMULATION_CONSENT_ALREADY_EXISTS";

            /// <summary>This emulation consent has already been revoked.</summary>
            public const string EMULATION_CONSENT_ALREADY_REVOKED = "auth_errors_EMULATION_CONSENT_ALREADY_REVOKED";

            /// <summary>Emulation is not allowed for this organization type.</summary>
            public const string EMULATION_ORG_TYPE_NOT_ALLOWED = "auth_errors_EMULATION_ORG_TYPE_NOT_ALLOWED";

            /// <summary>Invalid role specified.</summary>
            public const string INVALID_ROLE = "auth_errors_INVALID_ROLE";

            /// <summary>Failed to create the invitation.</summary>
            public const string INVITATION_CREATION_FAILED = "auth_errors_INVITATION_CREATION_FAILED";

            /// <summary>Inviter role cannot invite the specified role.</summary>
            public const string INVITATION_ROLE_HIERARCHY = "auth_errors_INVITATION_ROLE_HIERARCHY";

            /// <summary>The contact does not belong to this organization.</summary>
            public const string ORG_CONTACT_ORG_MISMATCH = "auth_errors_ORG_CONTACT_ORG_MISMATCH";

            /// <summary>Role is required.</summary>
            public const string ROLE_REQUIRED = "auth_errors_ROLE_REQUIRED";

            /// <summary>Too many sign-in attempts.</summary>
            public const string SIGN_IN_THROTTLED = "auth_errors_SIGN_IN_THROTTLED";
        }
    }

    /// <summary>
    /// Middleware translation keys.
    /// </summary>
    public static class Middleware
    {
        /// <summary>
        /// Middleware-specific error messages.
        /// </summary>
        public static class Errors
        {
            /// <summary>User has insufficient role for this operation.</summary>
            public const string INSUFFICIENT_ROLE = "middleware_errors_INSUFFICIENT_ROLE";

            /// <summary>No active organization on session.</summary>
            public const string NO_ACTIVE_ORGANIZATION = "middleware_errors_NO_ACTIVE_ORGANIZATION";

            /// <summary>Organization type is not authorized for this operation.</summary>
            public const string ORG_TYPE_NOT_AUTHORIZED = "middleware_errors_ORG_TYPE_NOT_AUTHORIZED";
        }
    }

    /// <summary>
    /// Comms service translation keys.
    /// </summary>
    public static class Comms
    {
        /// <summary>
        /// Comms-specific error messages.
        /// </summary>
        public static class Errors
        {
            /// <summary>Delivery failed on some channels, retry scheduled.</summary>
            public const string DELIVERY_RETRY_SCHEDULED = "comms_errors_DELIVERY_RETRY_SCHEDULED";

            /// <summary>No deliverable channels available for the recipient.</summary>
            public const string NO_DELIVERABLE_CHANNELS = "comms_errors_NO_DELIVERABLE_CHANNELS";

            /// <summary>Unknown provider error.</summary>
            public const string PROVIDER_UNKNOWN = "comms_errors_PROVIDER_UNKNOWN";
        }
    }
}
