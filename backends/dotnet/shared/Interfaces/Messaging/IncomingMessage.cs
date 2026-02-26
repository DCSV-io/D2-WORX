// -----------------------------------------------------------------------
// <copyright file="IncomingMessage.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Messaging;

/// <summary>
/// Wrapper around a deserialized message that includes AMQP metadata.
/// </summary>
///
/// <typeparam name="T">
/// The deserialized message body type.
/// </typeparam>
///
/// <param name="Body">
/// The deserialized message body.
/// </param>
/// <param name="Headers">
/// AMQP message headers.
/// </param>
/// <param name="MessageId">
/// The AMQP message ID, if present.
/// </param>
/// <param name="CorrelationId">
/// The AMQP correlation ID, if present.
/// </param>
/// <param name="Redelivered">
/// Whether this message has been redelivered by the broker.
/// </param>
public record IncomingMessage<T>(
    T Body,
    IDictionary<string, object?> Headers,
    string? MessageId,
    string? CorrelationId,
    bool Redelivered);
