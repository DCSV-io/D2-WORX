using D2.Contracts.Common;
using D2.Contracts.Common.App;
using S = D2.Contracts.Common.App.ICommonCacheService;

namespace Common.Infra.DistributedCache.Redis.Handlers;

/// <inheritdoc cref="S.IGetHandler{TValue}"/>
public class Get<TValue> : BaseHandler<
        S.IGetHandler<TValue>, S.GetInput, S.GetOutput<TValue>>,
    S.IGetHandler<TValue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Get{TValue}"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Get(IHandlerContext context) : base(context) { }

    /// <inheritdoc/>
    protected override ValueTask<D2Result<S.GetOutput<TValue>?>> ExecuteAsync(
        S.GetInput input,
        CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }
}
