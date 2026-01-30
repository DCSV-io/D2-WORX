// -----------------------------------------------------------------------
// <copyright file="ErrorCodes.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Result;

/// <summary>
/// Standardized error codes used across the application.
/// </summary>
public class ErrorCodes
{
    /// <summary>
    /// Indicates that the requested resource was not found.
    /// </summary>
    public const string NOT_FOUND = nameof(NOT_FOUND);

    /// <summary>
    /// Indicates that the action is forbidden due to insufficient permissions.
    /// </summary>
    public const string FORBIDDEN = nameof(FORBIDDEN);

    /// <summary>
    /// Indicates that the user is unauthorized to perform the action (e.g., not authenticated).
    /// </summary>
    public const string UNAUTHORIZED = nameof(UNAUTHORIZED);

    /// <summary>
    /// Indicates that the input validation has failed.
    /// </summary>
    public const string VALIDATION_FAILED = nameof(VALIDATION_FAILED);

    /// <summary>
    /// Indicates that a conflict occurred, such as a resource already existing.
    /// </summary>
    public const string CONFLICT = nameof(CONFLICT);

    /// <summary>
    /// Indicates that an unhandled exception has occurred.
    /// </summary>
    public const string UNHANDLED_EXCEPTION = nameof(UNHANDLED_EXCEPTION);

    /// <summary>
    /// Indicates that the data could not be serialized.
    /// </summary>
    public const string COULD_NOT_BE_SERIALIZED = nameof(COULD_NOT_BE_SERIALIZED);

    /// <summary>
    /// Indicates that the data could not be deserialized.
    /// </summary>
    public const string COULD_NOT_BE_DESERIALIZED = nameof(COULD_NOT_BE_DESERIALIZED);

    /// <summary>
    /// Indicates that the service is currently unavailable.
    /// </summary>
    public const string SERVICE_UNAVAILABLE = nameof(SERVICE_UNAVAILABLE);

    /// <summary>
    /// Indicates that some items were found in a query operation but not all.
    /// </summary>
    public const string SOME_FOUND = nameof(SOME_FOUND);
}
