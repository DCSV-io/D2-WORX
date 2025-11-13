using D2.Contracts.Result;

namespace D2.Contracts.Handler;

/// <summary>
/// Represents a handler that process an input of type <see cref="TInput"/> and produces an output
/// of type <see cref="TOutput"/>.
/// </summary>
///
/// <typeparam name="TInput">
/// The type of input the handler processes.
/// </typeparam>
/// <typeparam name="TOutput">
/// The type of output the handler produces.
/// </typeparam>
public interface IHandler<in TInput, TOutput>
{
    /// <summary>
    /// Handles the given input asynchronously and produces an output.
    /// </summary>
    ///
    /// <param name="input">
    /// The input to be processed by the handler.
    /// </param>
    /// <param name="ct">
    /// A cancellation token to cancel the operation.
    /// </param>
    /// <param name="options">
    /// Optional handler options to customize the handling behavior.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask{D2Result}"/> representing the asynchronous operation,
    /// containing the result of the handling process.
    /// </returns>
    public ValueTask<D2Result<TOutput?>> HandleAsync(
        TInput input,
        CancellationToken ct = default,
        HandlerOptions? options = null
    );
}
