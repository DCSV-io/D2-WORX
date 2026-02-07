// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Batch.Pg;

using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Extension methods for batched database queries.
/// </summary>
public static class Extensions
{
    extension<TEntity>(DbSet<TEntity> dbSet)
        where TEntity : class
    {
        /// <summary>
        /// Creates a batched query for fetching entities by a collection of IDs.
        /// </summary>
        ///
        /// <typeparam name="TKey">
        /// The key type.
        /// </typeparam>
        ///
        /// <param name="ids">
        /// The IDs to query.
        /// </param>
        /// <param name="keySelector">
        /// Expression to select the key property.
        /// </param>
        /// <param name="configure">
        /// Optional configuration action.
        /// </param>
        ///
        /// <returns>
        /// A BatchQuery that can be executed with ToListAsync, ToDictionaryAsync, etc.
        /// </returns>
        ///
        /// <example>
        /// <code>
        /// var locations = await db.Locations
        ///     .BatchGetByIds(hashIds, l => l.HashId)
        ///     .ToListAsync(ct);
        /// </code>
        /// </example>
        public BatchQuery<TEntity, TKey> BatchGetByIds<TKey>(
            IEnumerable<TKey> ids,
            Expression<Func<TEntity, TKey>> keySelector,
            Action<BatchOptions>? configure = null)
            where TKey : notnull
        {
            var options = new BatchOptions();
            configure?.Invoke(options);
            return new BatchQuery<TEntity, TKey>(dbSet, ids, keySelector, options);
        }
    }
}
