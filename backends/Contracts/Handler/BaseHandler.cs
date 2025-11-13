using System.Diagnostics;
using D2.Contracts.Result;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace D2.Contracts.Handler;

/// <summary>
/// A base implementation of the <see cref="IHandler{TInput, TOutput}"/> interface that provides
/// common functionality for handling requests, including logging, timing, and exception
/// handling.
/// </summary>
///
/// <typeparam name="THandler">
/// The type of the handler's implementation.
/// </typeparam>
/// <typeparam name="TInput">
/// The type of input the handler processes.
/// </typeparam>
/// <typeparam name="TOutput">
/// The type of output the handler produces.
/// </typeparam>
public abstract class BaseHandler<THandler, TInput, TOutput> : IHandler<TInput, TOutput>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="BaseHandler{THandler, TInput, TOutput}"/>
    /// class.
    /// </summary>
    ///
    /// <param name="context">
    /// The handler context for the current operation.
    /// </param>
    protected BaseHandler(IHandlerContext context)
    {
        Context = context;
    }

    /// <summary>
    /// The handler context for the current operation.
    /// </summary>
    protected readonly IHandlerContext Context;

    /// <summary>
    /// The trace ID associated with the current request.
    /// </summary>
    protected string? TraceId => Context.Request.TraceId;

    /// <inheritdoc />
    /// <remarks>
    /// This method wraps the execution of the handler with logging, timing, and exception
    /// handling. It logs the start and end of the handler execution, measures the elapsed time,
    /// and logs any unhandled exceptions that occur during execution. The actual handler logic is
    /// implemented in the abstract <see cref="ExecuteAsync"/> method, which must be overridden by
    /// derived classes.
    /// </remarks>
    public async ValueTask<D2Result<TOutput?>> HandleAsync(
        TInput input,
        CancellationToken ct = default,
        HandlerOptions? options = null)
    {
        // Create a new activity for tracing.
        using var activity = BHASW.SR_ActivitySource.StartActivity(typeof(THandler).Name);

        // Add metadata to the activity.
        activity?.SetTag("handler.type", typeof(THandler).FullName ?? typeof(THandler).Name);
        activity?.SetTag("trace.id", Context.Request.TraceId);
        activity?.SetTag("user.id", Context.Request.UserId);
        activity?.SetTag("agent.org.id", Context.Request.AgentOrgId);
        activity?.SetTag("target.org.id", Context.Request.TargetOrgId);

        // Start the stopwatch to measure elapsed time.
        var sw = Stopwatch.StartNew();

        // Use default options if none are provided.
        options ??= new HandlerOptions();

        // Wrap the execution in a try-catch to handle exceptions.
        try
        {
            // Log that we are now executing the handler.
            Context.Logger.LogInformation(
                "Executing handler {HandlerName}. TraceId: {TraceId}.",
                typeof(THandler).Name,
                Context.Request.TraceId);

            // Log the input as debug if enabled.
            if (options.LogInput)
            {
                Context.Logger.LogDebug(
                    "Handler {HandlerName} received input: {@Input}. TraceId: {TraceId}.",
                    typeof(THandler).Name,
                    input,
                    Context.Request.TraceId);
            }

            // Execute the handler's logic.
            var result = await ExecuteAsync(input, ct);

            // Stop the stopwatch to measure elapsed time.
            sw.Stop();
            var elapsedMs = sw.ElapsedMilliseconds;

            // Log the output as debug if enabled.
            if (options.LogOutput)
            {
                Context.Logger.LogDebug(
                    "Handler {HandlerName} produced result: {@Output}. TraceId: {TraceId}.",
                    typeof(THandler).Name,
                    result,
                    Context.Request.TraceId);
            }

            // Add result metadata to the activity.
            activity?.SetTag("handler.success", result.Success);
            activity?.SetTag("handler.status.code", result.StatusCode);
            activity?.SetTag("handler.error.code", result.ErrorCode);
            activity?.SetTag("handler.elapsed.ms", elapsedMs);
            activity?.SetStatus(result.Success ? ActivityStatusCode.Ok : ActivityStatusCode.Error);

            // Determine the log level based on success and elapsed time.
            var level = options.SuppressTimeWarnings
                ? result.Success
                    ? LogLevel.Information
                    : LogLevel.Warning
                : result.Success && elapsedMs < options.WarningThresholdMs
                    ? LogLevel.Information
                    : elapsedMs < options.CriticalThresholdMs
                        ? LogLevel.Warning
                        : LogLevel.Critical;

            // Log the completion of the handler execution.
            Context.Logger.Log(
                level,
                "Executed handler {HandlerName} {Status} in {ElapsedMilliseconds}ms. TraceId: {TraceId}.",
                typeof(THandler).Name,
                result.Success ? "successfully" : "unsuccessfully",
                elapsedMs,
                Context.Request.TraceId);

            // Return the result.
            return result;
        }
        catch (Exception ex)
        {
            // Stop the stopwatch.
            sw.Stop();
            var elapsedMs = sw.ElapsedMilliseconds;

            // Create an unhandled exception result.
            var errorResult = D2Result<TOutput?>.UnhandledException(
                traceId: Context.Request.TraceId);

            // Add exception metadata to the activity.
            activity?.SetTag("handler.success", errorResult.Success);
            activity?.SetTag("handler.status.code", errorResult.StatusCode);
            activity?.SetTag("handler.error.code", errorResult.ErrorCode);
            activity?.SetTag("handler.elapsed.ms", elapsedMs);
            activity?.SetStatus(ActivityStatusCode.Error);
            activity?.AddException(ex);

            // Log the unhandled exception.
            Context.Logger.LogError(
                ex,
                "Handler {HandlerName} encountered an unhandled exception after {ElapsedMilliseconds}ms. TraceId: {TraceId}.",
                typeof(THandler).Name,
                elapsedMs,
                Context.Request.TraceId);

            // Return the error result.
            return errorResult;
        }
    }

    /// <summary>
    /// Executes the core logic of the handler.
    /// </summary>
    ///
    /// <param name="input">
    /// The input to be processed by the handler.
    /// </param>
    /// <param name="ct">
    /// A cancellation token to cancel the operation.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask{D2Result}"/> containing the result of the handler's execution.
    /// </returns>
    protected abstract ValueTask<D2Result<TOutput?>> ExecuteAsync(
        TInput input,
        CancellationToken ct = default);

    /// <summary>
    /// Validates the input using a configurable <see cref="options"/>.
    /// </summary>
    ///
    /// <param name="options">
    /// An optional action to configure the validator.
    /// </param>
    /// <param name="input">
    /// The input to be validated.
    /// </param>
    /// <param name="ct">
    /// A cancellation token to cancel the validation operation.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="AbstractValidator{T}"/> representing the result of the validation.
    /// </returns>
    protected async ValueTask<D2Result> ValidateInput(
        Action<AbstractValidator<TInput>>? options,
        TInput input,
        CancellationToken ct = default)
    {
        // Create the validator with the provided configuration.
        var validator = new ConfigurableValidator(options);

        // Validate the input asynchronously.
        var validationResult = await validator.ValidateAsync(input, ct);

        // If valid, return OK.
        if (validationResult.IsValid)
            return D2Result.Ok(Context.Request.TraceId);

        // Group errors by property name and select into a 2D list.
        var errors = validationResult.Errors
            .GroupBy(e => e.PropertyName)
            .Select(g =>
                new List<string> { g.Key }
                    .Concat(g.Select(e => e.ErrorMessage))
                    .ToList())
            .ToList();

        // Return validation failed result with errors.
        return D2Result.ValidationFailed(
            inputErrors: errors,
            traceId: Context.Request.TraceId);
    }

    /// <summary>
    /// A configurable validator that allows dynamic configuration of validation rules via an
    /// action.
    /// </summary>
    private class ConfigurableValidator : AbstractValidator<TInput>
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="ConfigurableValidator"/> class.
        /// </summary>
        ///
        /// <param name="configure">
        /// An optional action to configure the validator.
        /// </param>
        public ConfigurableValidator(Action<AbstractValidator<TInput>>? configure = null)
            => configure?.Invoke(this);
    }
}

/// <summary>
/// Static class containing the activity source for the base handler.
/// </summary>
/// <remarks>
/// "BHASW" stands for "Base Handler Activity Source Wrapper".
/// </remarks>
internal static class BHASW
{
    /// <summary>
    /// The activity source for tracing handler operations.
    /// </summary>
    internal static readonly ActivitySource SR_ActivitySource
        = new("D2.Contracts.App.BaseHandler");
}
