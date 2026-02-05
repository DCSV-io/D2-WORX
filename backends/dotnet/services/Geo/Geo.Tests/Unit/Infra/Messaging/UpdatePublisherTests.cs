// -----------------------------------------------------------------------
// <copyright file="UpdatePublisherTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.Infra.Messaging;

using D2.Geo.Infra.Messaging.MT.Publishers;
using D2.Shared.Messages.Geo;
using FluentAssertions;
using MassTransit;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

/// <summary>
/// Unit tests for the <see cref="UpdatePublisher"/> class.
/// </summary>
public class UpdatePublisherTests
{
    private readonly Mock<IPublishEndpoint> r_publishEndpointMock;
    private readonly UpdatePublisher r_publisher;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdatePublisherTests"/> class.
    /// </summary>
    public UpdatePublisherTests()
    {
        r_publishEndpointMock = new Mock<IPublishEndpoint>();
        var loggerMock = new Mock<ILogger<UpdatePublisher>>();
        r_publisher = new UpdatePublisher(r_publishEndpointMock.Object, loggerMock.Object);
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
        r_publishEndpointMock
            .Setup(x => x.Publish(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var message = new GeoRefDataUpdated("1.0.0");

        // Act
        var result = await r_publisher.PublishAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        r_publishEndpointMock.Verify(
            x => x.Publish(
                It.Is<GeoRefDataUpdated>(m => m.Version == "1.0.0"),
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
        r_publishEndpointMock
            .Setup(x => x.Publish(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("RabbitMQ connection failed"));

        var message = new GeoRefDataUpdated("1.0.0");

        // Act
        var result = await r_publisher.PublishAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(System.Net.HttpStatusCode.ServiceUnavailable);
    }

    /// <summary>
    /// Tests that PublishAsync passes the message to the publish endpoint.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task PublishAsync_PassesMessageToEndpoint()
    {
        // Arrange
        GeoRefDataUpdated? capturedMessage = null;
        r_publishEndpointMock
            .Setup(x => x.Publish(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()))
            .Callback<object, CancellationToken>((msg, _) => capturedMessage = msg as GeoRefDataUpdated)
            .Returns(Task.CompletedTask);

        var message = new GeoRefDataUpdated("2.0.0");

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
        r_publishEndpointMock
            .Setup(x => x.Publish(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()))
            .Callback<object, CancellationToken>((_, ct) => capturedToken = ct)
            .Returns(Task.CompletedTask);

        using var cts = new CancellationTokenSource();
        var message = new GeoRefDataUpdated("1.0.0");

        // Act
        await r_publisher.PublishAsync(message, cts.Token);

        // Assert
        capturedToken.Should().Be(cts.Token);
    }
}
