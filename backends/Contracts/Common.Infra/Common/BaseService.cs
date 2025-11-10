using D2.Contracts.Common.App;

namespace Common.Infra.Common;

/// <summary>
/// Base class for services that require access to the handler context.
/// </summary>
public class BaseService
{
    /// <summary>
    /// Initializes a new instance of the <see cref="BaseService"/> class.
    /// </summary>
    ///
    /// <param name="context">
    /// The handler context to be used by the service.
    /// </param>
    protected BaseService(IHandlerContext context)
    {
        Context = context;
    }

    /// <summary>
    /// Gets the handler context associated with the service.
    /// </summary>
    protected IHandlerContext Context { get; }
}
