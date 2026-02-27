// -----------------------------------------------------------------------
// <copyright file="PredicateBuilder.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository;

using System.Linq.Expressions;

/// <summary>
/// Provides helper methods for building composite LINQ predicates that EF Core can translate to SQL.
/// </summary>
internal static class PredicateBuilder
{
    /// <summary>
    /// Combines two predicate expressions with a logical OR, rebinding parameters so EF Core
    /// generates a single WHERE clause with OR conditions.
    /// </summary>
    ///
    /// <typeparam name="T">
    /// The entity type the predicates operate on.
    /// </typeparam>
    /// <param name="left">
    /// The first predicate expression.
    /// </param>
    /// <param name="right">
    /// The second predicate expression.
    /// </param>
    ///
    /// <returns>
    /// A new expression that is the logical OR of both predicates, sharing a single parameter.
    /// </returns>
    public static Expression<Func<T, bool>> Or<T>(
        Expression<Func<T, bool>> left,
        Expression<Func<T, bool>> right)
    {
        // Use the left expression's parameter as the shared parameter.
        var parameter = left.Parameters[0];

        // Rebind the right expression's parameter to match the left's.
        var rebound = new ParameterRebinder(right.Parameters[0], parameter)
            .Visit(right.Body);

        var combined = Expression.OrElse(left.Body, rebound);
        return Expression.Lambda<Func<T, bool>>(combined, parameter);
    }

    /// <summary>
    /// Replaces all occurrences of one <see cref="ParameterExpression"/> with another in an
    /// expression tree.
    /// </summary>
    private sealed class ParameterRebinder(ParameterExpression from, ParameterExpression to)
        : ExpressionVisitor
    {
        /// <inheritdoc/>
        protected override Expression VisitParameter(ParameterExpression node)
            => node == from ? to : base.VisitParameter(node);
    }
}
