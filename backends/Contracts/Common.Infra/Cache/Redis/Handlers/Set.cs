using D2.Contracts.Common;
using D2.Contracts.Common.App;
using S = D2.Contracts.Common.App.ICacheService;

namespace Common.Infra.Cache.Redis.Handlers;

/// <inheritdoc cref="S.ISetHandler{TValue}"/>
public class Set<TValue> : BaseHandler<
        S.ISetHandler<TValue>, S.SetInput<TValue>, S.SetOutput>,
    S.ISetHandler<TValue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Set{TValue}"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Set(IHandlerContext context) : base(context) { }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<S.SetOutput?>> ExecuteAsync(
        S.SetInput<TValue> input,
        CancellationToken ct = default)
    {
        // TODO: Implement.
        return default;
    }
}
