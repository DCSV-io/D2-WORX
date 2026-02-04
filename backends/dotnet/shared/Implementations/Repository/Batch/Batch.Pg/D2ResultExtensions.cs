// -----------------------------------------------------------------------
// <copyright file="D2ResultExtensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Batch.Pg;

using D2.Shared.Result;

/// <summary>
/// Extensions for converting BatchQuery results to D2Result.
/// </summary>
public static class D2ResultExtensions
{
    extension<TEntity, TKey>(BatchQuery<TEntity, TKey> query)
        where TEntity : class
        where TKey : notnull
    {
        /// <summary>
        /// Executes the batch query and returns a D2Result with appropriate status.
        /// </summary>
        ///
        /// <remarks>
        /// Returns:
        /// <list type="bullet">
        /// <item><description>Ok: All requested IDs were found</description></item>
        /// <item><description>SomeFound: Some IDs were found (partial success, data included)</description></item>
        /// <item><description>NotFound: No IDs were found</description></item>
        /// <item><description>Ok with empty list: Input ID list was empty (not an error)</description></item>
        /// </list>
        /// </remarks>
        ///
        /// <param name="traceId">
        /// The trace ID for the result.
        /// </param>
        /// <param name="ct">
        /// Cancellation token.
        /// </param>
        ///
        /// <returns>
        /// D2Result containing the entities.
        /// </returns>
        public async Task<D2Result<List<TEntity>?>> ToD2ResultAsync(
            string? traceId,
            CancellationToken ct = default)
        {
            // Empty input is not an error - return Ok with empty list
            if (query.IdCount == 0)
            {
                return D2Result<List<TEntity>?>.Ok([], traceId: traceId);
            }

            var results = await query.ToListAsync(ct);

            return results.Count switch
            {
                0 => D2Result<List<TEntity>?>.NotFound(traceId: traceId),
                _ when results.Count < query.IdCount => D2Result<List<TEntity>?>.SomeFound(results, traceId: traceId),
                _ => D2Result<List<TEntity>?>.Ok(results, traceId: traceId),
            };
        }

        /// <summary>
        /// Executes the batch query and returns a D2Result with dictionary output.
        /// </summary>
        ///
        /// <param name="traceId">
        /// The trace ID for the result.
        /// </param>
        /// <param name="ct">
        /// Cancellation token.
        /// </param>
        ///
        /// <returns>
        /// D2Result containing a dictionary mapping IDs to entities.
        /// </returns>
        public async Task<D2Result<Dictionary<TKey, TEntity>?>> ToDictionaryD2ResultAsync(
            string? traceId,
            CancellationToken ct = default)
        {
            if (query.IdCount == 0)
            {
                return D2Result<Dictionary<TKey, TEntity>?>.Ok([], traceId: traceId);
            }

            var results = await query.ToDictionaryAsync(ct);

            return results.Count switch
            {
                0 => D2Result<Dictionary<TKey, TEntity>?>.NotFound(traceId: traceId),
                _ when results.Count < query.IdCount => D2Result<Dictionary<TKey, TEntity>?>.SomeFound(results, traceId: traceId),
                _ => D2Result<Dictionary<TKey, TEntity>?>.Ok(results, traceId: traceId),
            };
        }
    }
}
