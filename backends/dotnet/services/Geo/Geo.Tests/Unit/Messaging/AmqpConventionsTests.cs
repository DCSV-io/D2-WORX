// -----------------------------------------------------------------------
// <copyright file="AmqpConventionsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.Messaging;

using D2.Shared.Messaging.RabbitMQ.Conventions;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for <see cref="AmqpConventions"/>.
/// </summary>
public class AmqpConventionsTests
{
    /// <summary>
    /// Tests that EventExchange returns the correct format.
    /// </summary>
    /// <param name="service">The service name.</param>
    /// <param name="expected">The expected exchange name.</param>
    [Theory]
    [InlineData("geo", "events.geo")]
    [InlineData("auth", "events.auth")]
    [InlineData("comms", "events.comms")]
    public void EventExchange_ReturnsCorrectFormat(string service, string expected)
    {
        AmqpConventions.EventExchange(service).Should().Be(expected);
    }

    /// <summary>
    /// Tests that CommandExchange returns the correct format.
    /// </summary>
    /// <param name="service">The service name.</param>
    /// <param name="expected">The expected exchange name.</param>
    [Theory]
    [InlineData("geo", "commands.geo")]
    [InlineData("auth", "commands.auth")]
    [InlineData("comms", "commands.comms")]
    public void CommandExchange_ReturnsCorrectFormat(string service, string expected)
    {
        AmqpConventions.CommandExchange(service).Should().Be(expected);
    }

    /// <summary>
    /// Tests that same input always produces the same output.
    /// </summary>
    [Fact]
    public void EventExchange_SameInput_ReturnsSameOutput()
    {
        AmqpConventions.EventExchange("geo").Should().Be(AmqpConventions.EventExchange("geo"));
    }
}
