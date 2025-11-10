using D2.Contracts.Common;
using D2.Contracts.Common.App;
using H = D2.Contracts.Common.App.ICacheService.IExistsHandler;
using I = D2.Contracts.Common.App.ICacheService.ExistsInput;
using O = D2.Contracts.Common.App.ICacheService.ExistsOutput;

namespace Common.Infra.Cache.Redis.Handlers;

/// <inheritdoc cref="H"/>
public class Exists : BaseHandler<H, I, O>, H
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Exists"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Exists(IHandlerContext context) : base(context) { }

    /// <inheritdoc/>
    protected override ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // TODO: Implement.
        return default;
    }
}
