using Microsoft.Extensions.Logging;

namespace D2.Contracts.Handler;

/// <summary>
/// Implementation of the <see cref="IHandlerContext"/> interface, providing access to the request
/// context and logging capabilities.
/// </summary>
public class HandlerContext : IHandlerContext
{
    /// <summary>
    /// Initializes a new instance of the <see cref="HandlerContext"/> class.
    /// </summary>
    ///
    /// <param name="requestContext">
    ///  The request context associated with the handler.
    /// </param>
    /// <param name="logger">
    /// The logger for logging within the handler.
    /// </param>
    public HandlerContext(IRequestContext requestContext, ILogger logger)
    {
        Request = requestContext;
        Logger = logger;
    }

    /// <summary>
    /// Gets the request context associated with the handler.
    /// </summary>
    public IRequestContext Request { get; }

    /// <summary>
    /// Gets the logger for logging within the handler.
    /// </summary>
    public ILogger Logger { get; }
}
