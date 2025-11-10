using D2.Contracts.Common;
using D2.Contracts.Common.App;
using H = D2.Contracts.Common.App.ICacheService.IRemoveHandler;
using I = D2.Contracts.Common.App.ICacheService.RemoveInput;
using O = D2.Contracts.Common.App.ICacheService.RemoveOutput;

namespace Common.Infra.Cache.Redis.Handlers;

/// <inheritdoc cref="H"/>
public class Remove : BaseHandler<H, I, O>, H
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Remove"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Remove(IHandlerContext context) : base(context) { }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // TODO: Implement.
        return default;
    }
}
