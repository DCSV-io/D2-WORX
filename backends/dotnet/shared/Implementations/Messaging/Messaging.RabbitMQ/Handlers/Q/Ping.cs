// -----------------------------------------------------------------------
// <copyright file="Ping.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Messaging.RabbitMQ.Handlers.Q;

using System.Diagnostics;
using D2.Shared.Handler;
using D2.Shared.Result;
using global::RabbitMQ.Client;
using Microsoft.Extensions.Logging;

using H = D2.Shared.Interfaces.Messaging.Handlers.Q.IRead.IPingHandler;
using I = D2.Shared.Interfaces.Messaging.Handlers.Q.IRead.PingInput;
using O = D2.Shared.Interfaces.Messaging.Handlers.Q.IRead.PingOutput;

/// <summary>
/// Handler for pinging RabbitMQ to verify connectivity.
/// </summary>
public class Ping : BaseHandler<H, I, O>, H
{
    private readonly IConnection r_connection;

    /// <summary>
    /// Initializes a new instance of the <see cref="Ping"/> class.
    /// </summary>
    ///
    /// <param name="connection">
    /// The RabbitMQ connection.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Ping(
        IConnection connection,
        IHandlerContext context)
        : base(context)
    {
        r_connection = connection;
    }

    /// <inheritdoc/>
    protected override ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var isOpen = r_connection.IsOpen;
            sw.Stop();

            if (isOpen)
            {
                return ValueTask.FromResult(
                    D2Result<O?>.Ok(new O(true, sw.ElapsedMilliseconds, null)));
            }

            Context.Logger.LogWarning(
                "RabbitMQ connection is not open. TraceId: {TraceId}",
                TraceId);

            return ValueTask.FromResult(
                D2Result<O?>.Ok(new O(false, sw.ElapsedMilliseconds, "Connection is not open")));
        }
        catch (Exception ex)
        {
            sw.Stop();
            Context.Logger.LogError(
                ex,
                "RabbitMQ ping failed. TraceId: {TraceId}",
                TraceId);

            return ValueTask.FromResult(
                D2Result<O?>.Ok(new O(false, sw.ElapsedMilliseconds, ex.Message)));
        }
    }
}
