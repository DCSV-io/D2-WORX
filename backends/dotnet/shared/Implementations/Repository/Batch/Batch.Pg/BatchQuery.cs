// -----------------------------------------------------------------------
// <copyright file="BatchQuery.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Batch.Pg;

using System.Linq.Expressions;
using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Represents a batched query that chunks ID lookups for efficient database access.
/// </summary>
///
/// <typeparam name="TEntity">
/// The entity type.
/// </typeparam>
/// <typeparam name="TKey">
/// The key type.
/// </typeparam>
public sealed class BatchQuery<TEntity, TKey>
    where TEntity : class
    where TKey : notnull
{
    private readonly DbSet<TEntity> r_dbSet;
    private readonly IReadOnlyList<TKey> r_ids;
    private readonly Expression<Func<TEntity, TKey>> r_keySelector;
    private readonly BatchOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="BatchQuery{TEntity, TKey}"/> class.
    /// </summary>
    ///
    /// <param name="dbSet">
    /// The DbSet to query.
    /// </param>
    /// <param name="ids">
    /// The IDs to query for.
    /// </param>
    /// <param name="keySelector">
    /// Expression to select the key property from the entity.
    /// </param>
    /// <param name="options">
    /// Optional batch configuration options.
    /// </param>
    internal BatchQuery(
        DbSet<TEntity> dbSet,
        IEnumerable<TKey> ids,
        Expression<Func<TEntity, TKey>> keySelector,
        BatchOptions? options = null)
    {
        r_dbSet = dbSet;
        r_keySelector = keySelector;
        r_options = options ?? new BatchOptions();

        // Preprocess IDs based on options
        var processedIds = ids;

        if (r_options.FilterNullIds)
        {
            processedIds = processedIds.Where(id => id is not null && !EqualityComparer<TKey>.Default.Equals(id, default!));
        }

        if (r_options.DeduplicateIds)
        {
            processedIds = processedIds.Distinct();
        }

        r_ids = processedIds.ToList();
    }

    /// <summary>
    /// Gets the total count of IDs to query (after preprocessing).
    /// </summary>
    public int IdCount => r_ids.Count;

    /// <summary>
    /// Gets the expected number of batches.
    /// </summary>
    public int BatchCount => r_ids.Count == 0
        ? 0
        : (int)Math.Ceiling((double)r_ids.Count / r_options.BatchSize);

    /// <summary>
    /// Executes the batched query and returns all results as a list.
    /// </summary>
    ///
    /// <param name="ct">
    /// Cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A list of all matching entities.
    /// </returns>
    public async Task<List<TEntity>> ToListAsync(CancellationToken ct = default)
    {
        if (r_ids.Count == 0)
        {
            return [];
        }

        var results = new List<TEntity>(r_ids.Count);

        await foreach (var entity in ToAsyncEnumerable(ct))
        {
            results.Add(entity);
        }

        return results;
    }

    /// <summary>
    /// Executes the batched query and streams results.
    /// </summary>
    ///
    /// <param name="ct">
    /// Cancellation token.
    /// </param>
    ///
    /// <returns>
    /// An async enumerable of matching entities.
    /// </returns>
    public async IAsyncEnumerable<TEntity> ToAsyncEnumerable(
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        if (r_ids.Count == 0)
        {
            yield break;
        }

        foreach (var batch in r_ids.Chunk(r_options.BatchSize))
        {
            ct.ThrowIfCancellationRequested();

            var query = r_dbSet.Where(BuildContainsExpression(batch));

            if (r_options.AsNoTracking)
            {
                query = query.AsNoTracking();
            }

            await foreach (var entity in query.AsAsyncEnumerable().WithCancellation(ct))
            {
                yield return entity;
            }
        }
    }

    /// <summary>
    /// Executes the batched query and returns results as a dictionary keyed by ID.
    /// </summary>
    ///
    /// <param name="ct">
    /// Cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A dictionary mapping IDs to entities.
    /// </returns>
    public async Task<Dictionary<TKey, TEntity>> ToDictionaryAsync(CancellationToken ct = default)
    {
        if (r_ids.Count == 0)
        {
            return [];
        }

        var keyFunc = r_keySelector.Compile();
        var results = new Dictionary<TKey, TEntity>(r_ids.Count);

        await foreach (var entity in ToAsyncEnumerable(ct))
        {
            var key = keyFunc(entity);
            results.TryAdd(key, entity);  // First wins if duplicates somehow exist
        }

        return results;
    }

    /// <summary>
    /// Gets the IDs that were not found in the database.
    /// </summary>
    ///
    /// <param name="ct">
    /// Cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A set of IDs that were requested but not found.
    /// </returns>
    public async Task<HashSet<TKey>> GetMissingIdsAsync(CancellationToken ct = default)
    {
        var found = await ToDictionaryAsync(ct);
        return r_ids.Where(id => !found.ContainsKey(id)).ToHashSet();
    }

    private Expression<Func<TEntity, bool>> BuildContainsExpression(TKey[] batch)
    {
        var parameter = r_keySelector.Parameters[0];
        var keyAccess = r_keySelector.Body;

        var batchConstant = Expression.Constant(batch);
        var containsMethod = typeof(Enumerable)
            .GetMethods()
            .First(m => m.Name == nameof(Enumerable.Contains) && m.GetParameters().Length == 2)
            .MakeGenericMethod(typeof(TKey));

        var containsCall = Expression.Call(null, containsMethod, batchConstant, keyAccess);

        return Expression.Lambda<Func<TEntity, bool>>(containsCall, parameter);
    }
}
