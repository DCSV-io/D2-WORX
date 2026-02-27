// -----------------------------------------------------------------------
// <copyright file="PgErrorCodes.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Repository.Errors.Pg;

/// <summary>
/// PostgreSQL error code predicates for constraint violation handling.
/// Mirrors <c>@d2/errors-pg</c> (Node.js) error helpers.
/// <para>
/// These predicates inspect the <see cref="PostgresException.SqlState"/> to
/// determine the type of constraint violation, enabling handlers to return
/// structured <c>D2Result</c> failures (409 Conflict, 422, etc.) instead of
/// propagating raw 500s.
/// </para>
/// </summary>
/// <remarks>
/// Checks both the exception directly and <see cref="Exception.InnerException"/>
/// for compatibility with EF Core wrapping.
/// </remarks>
/// <seealso href="https://www.postgresql.org/docs/current/errcodes-appendix.html"/>
public static class PgErrorCodes
{
    /// <summary>
    /// Checks if the exception is a PostgreSQL unique constraint violation (23505).
    /// </summary>
    /// <param name="ex">The exception to check.</param>
    /// <returns><c>true</c> if the error code is 23505.</returns>
    public static bool IsUniqueViolation(Exception ex) => HasPgCode(ex, "23505");

    /// <summary>
    /// Checks if the exception is a PostgreSQL foreign key violation (23503).
    /// </summary>
    /// <param name="ex">The exception to check.</param>
    /// <returns><c>true</c> if the error code is 23503.</returns>
    public static bool IsForeignKeyViolation(Exception ex) => HasPgCode(ex, "23503");

    /// <summary>
    /// Checks if the exception is a PostgreSQL NOT NULL violation (23502).
    /// </summary>
    /// <param name="ex">The exception to check.</param>
    /// <returns><c>true</c> if the error code is 23502.</returns>
    public static bool IsNotNullViolation(Exception ex) => HasPgCode(ex, "23502");

    /// <summary>
    /// Checks if the exception is a PostgreSQL CHECK constraint violation (23514).
    /// </summary>
    /// <param name="ex">The exception to check.</param>
    /// <returns><c>true</c> if the error code is 23514.</returns>
    public static bool IsCheckViolation(Exception ex) => HasPgCode(ex, "23514");

    private static bool HasPgCode(Exception ex, string code)
    {
        // Direct: Npgsql PostgresException has SqlState.
        if (ex is PostgresException pgEx && pgEx.SqlState == code)
        {
            return true;
        }

        // Wrapped: EF Core may wrap in DbUpdateException (original in InnerException).
        if (ex.InnerException is PostgresException innerPgEx && innerPgEx.SqlState == code)
        {
            return true;
        }

        return false;
    }
}
