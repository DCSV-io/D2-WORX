// -----------------------------------------------------------------------
// <copyright file="ConsumerResult.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Messaging;

/// <summary>
/// Result returned by a message handler to indicate the processing outcome.
/// </summary>
/// <remarks>
/// There is no <c>Requeue</c> option — requeuing causes poison message tight loops.
/// If a message needs to be retried, re-publish it with a delay (e.g., DLX tiered retry).
/// </remarks>
public enum ConsumerResult
{
    /// <summary>
    /// Message was processed successfully. Acknowledge delivery.
    /// </summary>
    Ack = 0,

    /// <summary>
    /// Message should be dropped (NACK without requeue).
    /// </summary>
    Drop = 2,
}
