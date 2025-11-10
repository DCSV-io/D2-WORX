using D2.Contracts.Common;
using D2.Contracts.Common.App;
using H = D2.Contracts.Common.App.ICommonCacheService.IRemoveHandler;
using I = D2.Contracts.Common.App.ICommonCacheService.RemoveInput;
using O = D2.Contracts.Common.App.ICommonCacheService.RemoveOutput;

namespace Common.Infra.DistributedCache.Redis.Handlers;

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
    protected override ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }
}
