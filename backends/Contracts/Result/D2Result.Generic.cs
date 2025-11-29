// -----------------------------------------------------------------------
// <copyright file="D2Result.Generic.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Result;

using System.Net;

/// <summary>
/// Represents the result of an operation, including success status, messages, errors, and
/// additional metadata including the resulting data of type <typeparamref name="TData"/>.
/// </summary>
/// <typeparam name="TData">
/// The type of the data returned by the operation.
/// </typeparam>
public class D2Result<TData> : D2Result
{
    /// <summary>
    /// Initializes a new instance of the <see cref="D2Result{T}"/> class.
    /// </summary>
    ///
    /// <param name="success">
    /// Indicates whether the operation was successful.
    /// </param>
    /// <param name="data">
    /// The resulting data of the operation. Optional.
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
        TData? data = default,
        List<string>? messages = null,
        List<List<string>>? inputErrors = null,
        HttpStatusCode? statusCode = null,
        string? errorCode = null,
        string? traceId = null)
        : base(
        success,
        messages,
        inputErrors,
        statusCode,
        errorCode,
        traceId)
    {
        Data = data;
    }

    /// <summary>
    /// Gets the resulting data of the operation.
    /// </summary>
    public TData? Data { get; }

    #region Factory Methods

    /// <summary>
    /// Factory method to create a successful <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="data">
    /// The resulting data of the operation. Optional.
    /// </param>
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A successful <see cref="D2Result{TResult}"/> instance containing the result data.
    /// </returns>
    public static D2Result<TData> Ok(
        TData? data = default,
        List<string>? messages = null,
        string? traceId = null)
        => new(
            true,
            data,
            messages,
            traceId: traceId);

    /// <summary>
    /// Factory method to create a failed <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
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
    /// A failed <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static new D2Result<TData> Fail(
        List<string>? messages = null,
        HttpStatusCode? statusCode = null,
        List<List<string>>? inputErrors = null,
        string? errorCode = null,
        string? traceId = null)
        => new(
            false,
            default,
            messages,
            inputErrors,
            statusCode,
            errorCode,
            traceId);

    /// <summary>
    /// Factory method to bubble up a failed <see cref="D2Result"/> into a
    /// <see cref="D2Result{TResult}"/> without a result.
    /// </summary>
    ///
    /// <param name="d2Result">
    /// The failed <see cref="D2Result"/> to bubble up.
    /// </param>
    ///
    /// <returns>
    /// A failed <see cref="D2Result{TResult}"/> instance containing error details from the
    /// provided <see cref="D2Result"/>.
    /// </returns>
    public static D2Result<TData> BubbleFail(
        D2Result d2Result)
        => new(
            false,
            default,
            d2Result.Messages,
            d2Result.InputErrors,
            d2Result.StatusCode,
            d2Result.ErrorCode,
            d2Result.TraceId);

    /// <summary>
    /// Factory method to bubble up a <see cref="D2Result"/> into a
    /// <see cref="D2Result{TResult}"/> with result data.
    /// </summary>
    ///
    /// <param name="d2Result">
    /// The <see cref="D2Result"/> to bubble up.
    /// </param>
    /// <param name="data">
    /// The resulting data of the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="D2Result{TResult}"/> instance containing the result data and details from the
    /// provided <see cref="D2Result"/>.
    /// </returns>
    public static D2Result<TData> Bubble(
        D2Result d2Result,
        TData? data = default)
        => new(
            d2Result.Success,
            data,
            d2Result.Messages,
            d2Result.InputErrors,
            d2Result.StatusCode,
            d2Result.ErrorCode,
            d2Result.TraceId);

    /// <summary>
    /// Factory method to create a created <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="data">
    /// The resulting data of the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A created <see cref="D2Result{TResult}"/> instance containing the result data.
    /// </returns>
    public static D2Result<TData> Created(
        TData? data = default,
        string? traceId = null)
        => new(
            true,
            data,
            statusCode: HttpStatusCode.Created,
            traceId: traceId);

    /// <summary>
    /// Factory method to create a not found <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A not found <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static D2Result<TData> NotFound(
        List<string>? messages = null,
        string? traceId = null)
    {
        messages ??= ["Resource not found."];
        return new(
            false,
            default,
            messages,
            statusCode: HttpStatusCode.NotFound,
            errorCode: ErrorCodes.NOT_FOUND,
            traceId: traceId);
    }

    /// <summary>
    /// Factory method to create a forbidden <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A forbidden <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static D2Result<TData> Forbidden(
        List<string>? messages = null,
        string? traceId = null)
    {
        messages ??= ["Insufficient permissions."];
        return new(
            false,
            default,
            messages,
            statusCode: HttpStatusCode.Forbidden,
            errorCode: ErrorCodes.FORBIDDEN,
            traceId: traceId);
    }

    /// <summary>
    /// Factory method to create an unauthorized <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// An unauthorized <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static D2Result<TData> Unauthorized(
        List<string>? messages = null,
        string? traceId = null)
    {
        messages ??= ["You must be signed in to perform this action."];
        return new(
            false,
            default,
            messages,
            statusCode: HttpStatusCode.Unauthorized,
            errorCode: ErrorCodes.UNAUTHORIZED,
            traceId: traceId);
    }

    /// <summary>
    /// Factory method to create a validation failed <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
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
    /// A validation failed <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static new D2Result<TData> ValidationFailed(
        List<string>? messages = null,
        List<List<string>>? inputErrors = null,
        string? traceId = null)
    {
        messages ??= ["One or more validation errors occurred."];
        return new(
            false,
            default,
            messages,
            inputErrors,
            statusCode: HttpStatusCode.BadRequest,
            errorCode: ErrorCodes.VALIDATION_FAILED,
            traceId: traceId);
    }

    /// <summary>
    /// Factory method to create a conflict <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// A conflict <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static D2Result<TData> Conflict(
        List<string>? messages = null,
        string? traceId = null)
    {
        messages ??= ["Conflict occurred while processing the request."];
        return new(
            false,
            default,
            messages,
            statusCode: HttpStatusCode.Conflict,
            errorCode: ErrorCodes.CONFLICT,
            traceId: traceId);
    }

    /// <summary>
    /// Factory method to create an unhandled exception <see cref="D2Result{TResult}"/> instance.
    /// </summary>
    ///
    /// <param name="messages">
    /// A list of messages related to the operation. Optional.
    /// </param>
    /// <param name="traceId">
    /// The trace identifier to correlate logs and diagnostics for the operation. Optional.
    /// </param>
    ///
    /// <returns>
    /// An unhandled exception <see cref="D2Result{TResult}"/> instance containing error details.
    /// </returns>
    public static D2Result<TData> UnhandledException(
        List<string>? messages = null,
        string? traceId = null)
    {
        messages ??= ["An unhandled exception occurred while processing the request."];
        return new(
            false,
            default,
            messages,
            statusCode: HttpStatusCode.InternalServerError,
            errorCode: ErrorCodes.UNHANDLED_EXCEPTION,
            traceId: traceId);
    }

    #endregion

    #region Functionality

    /// <summary>
    /// Checks if the operation was successful and retrieves the result data.
    /// </summary>
    ///
    /// <param name="data">
    /// The resulting data of the operation, if successful; otherwise, null.
    /// </param>
    ///
    /// <returns>
    /// True if the operation was successful; otherwise, false.
    /// </returns>
    public bool CheckSuccess(
        out TData? data)
    {
        data = Data;
        return Success;
    }

    /// <summary>
    /// Checks if the operation failed and retrieves the result data.
    /// </summary>
    ///
    /// <param name="data">
    /// The resulting data of the operation, if failed; otherwise, null.
    /// </param>
    ///
    /// <returns>
    /// True if the operation failed; otherwise, false.
    /// </returns>
    public bool CheckFailure(
        out TData? data)
    {
        data = Data;
        return Failed;
    }

    #endregion
}
