// -----------------------------------------------------------------------
// <copyright file="D2Result.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Result;

using System.Net;

/// <summary>
/// Represents the result of an operation, including success status, messages, errors, and related
/// metadata.
/// </summary>
public class D2Result
{
    /// <summary>
    /// Initializes a new instance of the <see cref="D2Result"/> class.
    /// </summary>
    ///
    /// <param name="success">
    /// Indicates whether the operation was successful. Required.
    /// </param>
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="inputErrors">
    /// A two-dimensional list representing input errors, where each inner list contains the name
    /// of the field and each proceeding string is an error message related to that field. Optional.
    /// </param>
    /// <param name="statusCode">
    /// The <see cref="HttpStatusCode"/> representing the outcome of the operation. Optional.
    /// </param>
    /// <param name="errorCode">
    /// A standardized error code representing a known failure condition. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    public D2Result(
        bool success,
        List<string>? messages = null,
        List<List<string>>? inputErrors = null,
        HttpStatusCode? statusCode = null,
        string? errorCode = null,
        string? traceId = null)
    {
        Success = success;
        Messages = messages ?? [];
        InputErrors = inputErrors ?? [];
        StatusCode = statusCode ?? (success ? HttpStatusCode.OK : HttpStatusCode.BadRequest);
        ErrorCode = errorCode;
        TraceId = traceId;
    }

    /// <summary>
    /// Gets a value indicating whether indicates whether the operation was successful.
    /// </summary>
    public bool Success { get; }

    /// <summary>
    /// Gets a value indicating whether indicates whether the operation failed.
    /// </summary>
    public bool Failed => !Success;

    /// <summary>
    /// Gets a list of messages related to the operation.
    /// </summary>
    public List<string> Messages { get; }

    /// <summary>
    /// Gets a two-dimensional list representing input errors, where each inner list contains the name
    /// of the field and each proceeding string is an error message related to that field.
    /// </summary>
    /// <remarks>
    /// This structure allows for multiple errors to be associated with a single input field,
    /// allowing clients to easily identify and display all relevant validation issues for each
    /// provided field.
    /// </remarks>
    public List<List<string>> InputErrors { get; }

    /// <summary>
    /// Gets the <see cref="HttpStatusCode"/> representing the outcome of the operation.
    /// </summary>
    public HttpStatusCode StatusCode { get; }

    /// <summary>
    /// Gets a standardized error code representing a known failure condition, if applicable.
    /// </summary>
    public string? ErrorCode { get; }

    /// <summary>
    /// Gets the trace identifier to correlate logs and diagnostics for the operation, if available.
    /// </summary>
    public string? TraceId { get; }

    #region Functionality

    /// <summary>
    /// Factory method to create a successful <see cref="D2Result"/> instance.
    /// </summary>
    ///
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A new successful <see cref="D2Result"/> instance.
    /// </returns>
    public static D2Result Ok(string? traceId = null) => new(true, traceId: traceId);

    /// <summary>
    /// Factory method to create a failed <see cref="D2Result"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the failure. Optional.
    /// </param>
    /// <param name="statusCode">
    /// The <see cref="HttpStatusCode"/> representing the outcome of the operation. Optional.
    /// </param>
    /// <param name="inputErrors">
    /// A two-dimensional list representing input errors, where each inner list contains the name
    /// of the field and each proceeding string is an error message related to that field. Optional.
    /// </param>
    /// <param name="errorCode">
    /// A standardized error code representing a known failure condition. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A new failed <see cref="D2Result"/> instance.
    /// </returns>
    public static D2Result Fail(
        List<string>? messages = null,
        HttpStatusCode? statusCode = null,
        List<List<string>>? inputErrors = null,
        string? errorCode = null,
        string? traceId = null)
        => new(
            false,
            messages,
            inputErrors,
            statusCode,
            errorCode,
            traceId);

    /// <summary>
    /// Factory method to create a validation failed <see cref="D2Result"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the validation failure. Optional.
    /// </param>
    /// <param name="inputErrors">
    /// A two-dimensional list representing input errors, where each inner list contains the name
    /// of the field and each proceeding string is an error message related to that field. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A new validation failed <see cref="D2Result"/> instance.
    /// </returns>
    public static D2Result ValidationFailed(
        List<string>? messages = null,
        List<List<string>>? inputErrors = null,
        string? traceId = null)
    {
        messages ??= ["One or more validation errors occurred."];
        return new(
            false,
            messages,
            inputErrors,
            statusCode: HttpStatusCode.BadRequest,
            errorCode: ErrorCodes.VALIDATION_FAILED,
            traceId: traceId);
    }

    /// <summary>
    /// Factory method to create a cancelled <see cref="D2Result"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the cancellation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A new cancelled <see cref="D2Result"/> instance.
    /// </returns>
    public static D2Result Cancelled(
        List<string>? messages = null,
        string? traceId = null)
    {
        messages ??= ["The operation was cancelled."];
        return new(
            false,
            messages,
            statusCode: HttpStatusCode.BadRequest,
            errorCode: ErrorCodes.CANCELLED,
            traceId: traceId);
    }

    #endregion
}
