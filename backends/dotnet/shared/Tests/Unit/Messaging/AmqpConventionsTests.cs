// -----------------------------------------------------------------------
// <copyright file="AmqpConventionsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Messaging;

using D2.Shared.Messaging.RabbitMQ.Conventions;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for <see cref="AmqpConventions"/>.
/// </summary>
public class AmqpConventionsTests
{
    #region EventExchange

    /// <summary>
    /// Tests that EventExchange returns the correct format for a given service name.
    /// </summary>
    [Fact]
    public void EventExchange_WithServiceName_ReturnsCorrectFormat()
    {
        // Arrange & Act
        var result = AmqpConventions.EventExchange("geo");

        // Assert
        result.Should().Be("events.geo");
    }

    /// <summary>
    /// Tests that EventExchange produces different names for different services.
    /// </summary>
    ///
    /// <param name="service">
    /// The service name.
    /// </param>
    /// <param name="expected">
    /// The expected exchange name.
    /// </param>
    [Theory]
    [InlineData("geo", "events.geo")]
    [InlineData("auth", "events.auth")]
    [InlineData("comms", "events.comms")]
    [InlineData("billing", "events.billing")]
    public void EventExchange_WithVariousServices_ReturnsExpectedNames(
        string service, string expected)
    {
        // Arrange & Act
        var result = AmqpConventions.EventExchange(service);

        // Assert
        result.Should().Be(expected);
    }

    /// <summary>
    /// Tests that EventExchange always prefixes with "events." .
    /// </summary>
    [Fact]
    public void EventExchange_AlwaysPrefixesWithEvents()
    {
        // Arrange & Act
        var result = AmqpConventions.EventExchange("any-service");

        // Assert
        result.Should().StartWith("events.");
    }

    /// <summary>
    /// Tests that EventExchange handles empty service name gracefully.
    /// </summary>
    [Fact]
    public void EventExchange_WithEmptyServiceName_ReturnsEventsPrefix()
    {
        // Arrange & Act
        var result = AmqpConventions.EventExchange(string.Empty);

        // Assert
        result.Should().Be("events.");
    }

    #endregion

    #region CommandExchange

    /// <summary>
    /// Tests that CommandExchange returns the correct format for a given service name.
    /// </summary>
    [Fact]
    public void CommandExchange_WithServiceName_ReturnsCorrectFormat()
    {
        // Arrange & Act
        var result = AmqpConventions.CommandExchange("geo");

        // Assert
        result.Should().Be("commands.geo");
    }

    /// <summary>
    /// Tests that CommandExchange produces different names for different services.
    /// </summary>
    ///
    /// <param name="service">
    /// The service name.
    /// </param>
    /// <param name="expected">
    /// The expected exchange name.
    /// </param>
    [Theory]
    [InlineData("geo", "commands.geo")]
    [InlineData("auth", "commands.auth")]
    [InlineData("comms", "commands.comms")]
    [InlineData("billing", "commands.billing")]
    public void CommandExchange_WithVariousServices_ReturnsExpectedNames(
        string service, string expected)
    {
        // Arrange & Act
        var result = AmqpConventions.CommandExchange(service);

        // Assert
        result.Should().Be(expected);
    }

    /// <summary>
    /// Tests that CommandExchange always prefixes with "commands." .
    /// </summary>
    [Fact]
    public void CommandExchange_AlwaysPrefixesWithCommands()
    {
        // Arrange & Act
        var result = AmqpConventions.CommandExchange("any-service");

        // Assert
        result.Should().StartWith("commands.");
    }

    /// <summary>
    /// Tests that CommandExchange handles empty service name gracefully.
    /// </summary>
    [Fact]
    public void CommandExchange_WithEmptyServiceName_ReturnsCommandsPrefix()
    {
        // Arrange & Act
        var result = AmqpConventions.CommandExchange(string.Empty);

        // Assert
        result.Should().Be("commands.");
    }

    #endregion

    #region Exchange Name Differentiation

    /// <summary>
    /// Tests that event and command exchanges produce different names for the same service.
    /// </summary>
    [Fact]
    public void EventAndCommandExchanges_ForSameService_AreDifferent()
    {
        // Arrange & Act
        var eventExchange = AmqpConventions.EventExchange("geo");
        var commandExchange = AmqpConventions.CommandExchange("geo");

        // Assert
        eventExchange.Should().NotBe(commandExchange);
    }

    /// <summary>
    /// Tests that the service name is preserved in both exchange names.
    /// </summary>
    [Fact]
    public void BothExchangeTypes_ContainServiceName()
    {
        // Arrange
        const string service = "geo";

        // Act
        var eventExchange = AmqpConventions.EventExchange(service);
        var commandExchange = AmqpConventions.CommandExchange(service);

        // Assert
        eventExchange.Should().EndWith(service);
        commandExchange.Should().EndWith(service);
    }

    #endregion
}
