// -----------------------------------------------------------------------
// <copyright file="UpdatePublisherTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.Infra.Messaging;

using D2.Events.Protos.V1;
using D2.Geo.Infra.Messaging.Publishers;
using D2.Shared.Messaging.RabbitMQ;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

/// <summary>
/// Unit tests for the <see cref="UpdatePublisher"/> class.
/// </summary>
public class UpdatePublisherTests
{
    private readonly Mock<ProtoPublisher> r_protoPublisherMock;
    private readonly UpdatePublisher r_publisher;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatePublisherTests"/> class.
    /// </summary>
    public UpdatePublisherTests()
    {
        r_protoPublisherMock = new Mock<ProtoPublisher>(
            Mock.Of<RabbitMQ.Client.IConnection>(),
            Mock.Of<ILogger<ProtoPublisher>>());
        var loggerMock = new Mock<ILogger<UpdatePublisher>>();
        r_publisher = new UpdatePublisher(r_protoPublisherMock.Object, loggerMock.Object);
    }

    /// <summary>
    /// Tests that PublishAsync returns success when publish succeeds.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task PublishAsync_WhenSuccessful_ReturnsSuccess()
    {
        // Arrange
        r_protoPublisherMock
            .Setup(x => x.PublishAsync(
                It.IsAny<string>(),
                It.IsAny<GeoRefDataUpdatedEvent>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var message = new GeoRefDataUpdatedEvent { Version = "1.0.0" };

        // Act
        var result = await r_publisher.PublishAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        r_protoPublisherMock.Verify(
            x => x.PublishAsync(
                "events.geo",
                It.Is<GeoRefDataUpdatedEvent>(m => m.Version == "1.0.0"),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that PublishAsync returns failure when publish throws an exception.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task PublishAsync_WhenExceptionThrown_ReturnsFailure()
    {
        // Arrange
        r_protoPublisherMock
            .Setup(x => x.PublishAsync(
                It.IsAny<string>(),
                It.IsAny<GeoRefDataUpdatedEvent>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("RabbitMQ connection failed"));

        var message = new GeoRefDataUpdatedEvent { Version = "1.0.0" };

        // Act
        var result = await r_publisher.PublishAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(System.Net.HttpStatusCode.ServiceUnavailable);
    }

    /// <summary>
    /// Tests that PublishAsync passes the message to the proto publisher.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task PublishAsync_PassesMessageToPublisher()
    {
        // Arrange
        GeoRefDataUpdatedEvent? capturedMessage = null;
        r_protoPublisherMock
            .Setup(x => x.PublishAsync(
                It.IsAny<string>(),
                It.IsAny<GeoRefDataUpdatedEvent>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, GeoRefDataUpdatedEvent, string, CancellationToken>(
                (_, msg, _, _) => capturedMessage = msg)
            .Returns(Task.CompletedTask);

        var message = new GeoRefDataUpdatedEvent { Version = "2.0.0" };

        // Act
        await r_publisher.PublishAsync(message, CancellationToken.None);

        // Assert
        capturedMessage.Should().NotBeNull();
        capturedMessage!.Version.Should().Be("2.0.0");
    }

    /// <summary>
    /// Tests that PublishAsync respects the cancellation token.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task PublishAsync_PassesCancellationToken()
    {
        // Arrange
        CancellationToken capturedToken = CancellationToken.None;
        r_protoPublisherMock
            .Setup(x => x.PublishAsync(
                It.IsAny<string>(),
                It.IsAny<GeoRefDataUpdatedEvent>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, GeoRefDataUpdatedEvent, string, CancellationToken>(
                (_, _, _, ct) => capturedToken = ct)
            .Returns(Task.CompletedTask);

        using var cts = new CancellationTokenSource();
        var message = new GeoRefDataUpdatedEvent { Version = "1.0.0" };

        // Act
        await r_publisher.PublishAsync(message, cts.Token);

        // Assert
        capturedToken.Should().Be(cts.Token);
    }
}
