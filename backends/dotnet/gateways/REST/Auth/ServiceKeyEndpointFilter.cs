// -----------------------------------------------------------------------
// <copyright file="ServiceKeyEndpointFilter.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Auth;

using Microsoft.Extensions.Options;

/// <summary>
/// Endpoint filter that validates the <c>X-Api-Key</c> header against
/// configured service keys. Returns 401 Unauthorized if the key is
/// missing or invalid.
/// </summary>
public class ServiceKeyEndpointFilter : IEndpointFilter
{
    private const string _HEADER_NAME = "X-Api-Key";

    private readonly HashSet<string> r_validKeys;

    /// <summary>
    /// Initializes a new instance of the <see cref="ServiceKeyEndpointFilter"/> class.
    /// </summary>
    ///
    /// <param name="options">
    /// The service key configuration options.
    /// </param>
    public ServiceKeyEndpointFilter(IOptions<ServiceKeyOptions> options)
    {
        r_validKeys = new HashSet<string>(
            options.Value.ValidKeys,
            StringComparer.Ordinal);
    }

    /// <inheritdoc/>
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var apiKey = context.HttpContext.Request.Headers[_HEADER_NAME].FirstOrDefault();

        if (string.IsNullOrEmpty(apiKey) || !r_validKeys.Contains(apiKey))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Unauthorized",
                detail: "A valid service API key is required.");
        }

        return await next(context);
    }
}
