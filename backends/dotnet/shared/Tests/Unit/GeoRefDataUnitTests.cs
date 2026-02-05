// -----------------------------------------------------------------------
// <copyright file="GeoRefDataUnitTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable RedundantCapturedContext
namespace D2.Shared.Tests.Unit;

using D2.Services.Protos.Geo.V1;
using D2.Shared.GeoRefDataService.Default.Messaging.Handlers.Sub;
using D2.Shared.GeoRefDataService.Default.Messaging.MT.Consumers;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Common.GeoRefData.CQRS.Handlers.C;
using D2.Shared.Interfaces.Common.GeoRefData.CQRS.Handlers.Q;
using D2.Shared.Interfaces.Common.GeoRefData.CQRS.Handlers.X;
using D2.Shared.Interfaces.Common.GeoRefData.Messaging.Handlers.Sub;
using D2.Shared.Messages.Geo;
using D2.Shared.Result;
using FluentAssertions;
using MassTransit;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Unit tests for GeoRefData handlers and consumers.
/// </summary>
public class GeoRefDataUnitTests
{
    private readonly Mock<IComplex.IGetHandler> r_getHandler = new();
    private readonly Mock<IQueries.IGetFromDistHandler> r_getFromDist = new();
    private readonly Mock<ICommands.ISetInMemHandler> r_setInMem = new();
    private readonly Mock<ICommands.ISetOnDiskHandler> r_setOnDisk = new();
    private readonly IHandlerContext r_context = TestHelpers.CreateHandlerContext();

    /// <summary>
    /// Tests that Updated handler succeeds even when SetInMem fails.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Updated_WhenSetInMemFails_StillSucceeds()
    {
        // Arrange
        var testData = TestHelpers.TestGeoRefData;

        r_getHandler
            .Setup(x => x.HandleAsync(It.IsAny<IComplex.GetInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IComplex.GetOutput?>.Ok(
                new IComplex.GetOutput(new GeoRefData { Version = "1.0.0" })));

        r_getFromDist
            .Setup(x => x.HandleAsync(It.IsAny<IQueries.GetFromDistInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IQueries.GetFromDistOutput?>.Ok(
                new IQueries.GetFromDistOutput(testData)));

        r_setInMem
            .Setup(x => x.HandleAsync(It.IsAny<ICommands.SetInMemInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ICommands.SetInMemOutput?>.Fail(
                ["Memory cache error"],
                HttpStatusCode.InternalServerError));

        r_setOnDisk
            .Setup(x => x.HandleAsync(It.IsAny<ICommands.SetOnDiskInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ICommands.SetOnDiskOutput?>.Ok(new ICommands.SetOnDiskOutput()));

        var handler = new Updated(
            r_getHandler.Object,
            r_getFromDist.Object,
            r_setInMem.Object,
            r_setOnDisk.Object,
            r_context);

        var message = new GeoRefDataUpdated("2.0.0");

        // Act
        var result = await handler.HandleAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        r_setInMem.Verify(x => x.HandleAsync(It.IsAny<ICommands.SetInMemInput>(), It.IsAny<CancellationToken>()), Times.Once);
        r_setOnDisk.Verify(x => x.HandleAsync(It.IsAny<ICommands.SetOnDiskInput>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Tests that Updated handler succeeds even when SetOnDisk fails.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Updated_WhenSetOnDiskFails_StillSucceeds()
    {
        // Arrange
        var testData = TestHelpers.TestGeoRefData;

        r_getHandler
            .Setup(x => x.HandleAsync(It.IsAny<IComplex.GetInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IComplex.GetOutput?>.Ok(
                new IComplex.GetOutput(new GeoRefData { Version = "1.0.0" })));

        r_getFromDist
            .Setup(x => x.HandleAsync(It.IsAny<IQueries.GetFromDistInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IQueries.GetFromDistOutput?>.Ok(
                new IQueries.GetFromDistOutput(testData)));

        r_setInMem
            .Setup(x => x.HandleAsync(It.IsAny<ICommands.SetInMemInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ICommands.SetInMemOutput?>.Ok(new ICommands.SetInMemOutput()));

        r_setOnDisk
            .Setup(x => x.HandleAsync(It.IsAny<ICommands.SetOnDiskInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ICommands.SetOnDiskOutput?>.Fail(
                ["Disk write error"],
                HttpStatusCode.InternalServerError));

        var handler = new Updated(
            r_getHandler.Object,
            r_getFromDist.Object,
            r_setInMem.Object,
            r_setOnDisk.Object,
            r_context);

        var message = new GeoRefDataUpdated("2.0.0");

        // Act
        var result = await handler.HandleAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        r_setInMem.Verify(x => x.HandleAsync(It.IsAny<ICommands.SetInMemInput>(), It.IsAny<CancellationToken>()), Times.Once);
        r_setOnDisk.Verify(x => x.HandleAsync(It.IsAny<ICommands.SetOnDiskInput>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Tests that Updated handler succeeds even when both SetInMem and SetOnDisk fail.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Updated_WhenBothCacheSetsFail_StillSucceeds()
    {
        // Arrange
        var testData = TestHelpers.TestGeoRefData;

        r_getHandler
            .Setup(x => x.HandleAsync(It.IsAny<IComplex.GetInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IComplex.GetOutput?>.Ok(
                new IComplex.GetOutput(new GeoRefData { Version = "1.0.0" })));

        r_getFromDist
            .Setup(x => x.HandleAsync(It.IsAny<IQueries.GetFromDistInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<IQueries.GetFromDistOutput?>.Ok(
                new IQueries.GetFromDistOutput(testData)));

        r_setInMem
            .Setup(x => x.HandleAsync(It.IsAny<ICommands.SetInMemInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ICommands.SetInMemOutput?>.Fail(
                ["Memory cache error"],
                HttpStatusCode.InternalServerError));

        r_setOnDisk
            .Setup(x => x.HandleAsync(It.IsAny<ICommands.SetOnDiskInput>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ICommands.SetOnDiskOutput?>.Fail(
                ["Disk write error"],
                HttpStatusCode.InternalServerError));

        var handler = new Updated(
            r_getHandler.Object,
            r_getFromDist.Object,
            r_setInMem.Object,
            r_setOnDisk.Object,
            r_context);

        var message = new GeoRefDataUpdated("2.0.0");

        // Act
        var result = await handler.HandleAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    /// <summary>
    /// Tests that UpdatedConsumer completes successfully when handler succeeds.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task UpdatedConsumer_WhenHandlerSucceeds_CompletesWithoutException()
    {
        // Arrange
        var mockHandler = new Mock<ISubs.IUpdatedHandler>();
        mockHandler
            .Setup(x => x.HandleAsync(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ISubs.UpdatedOutput?>.Ok(new ISubs.UpdatedOutput()));

        var mockLogger = new Mock<ILogger<UpdatedConsumer>>();
        var mockContext = new Mock<ConsumeContext<GeoRefDataUpdated>>();
        mockContext.Setup(x => x.Message).Returns(new GeoRefDataUpdated("1.0.0"));
        mockContext.Setup(x => x.CancellationToken).Returns(CancellationToken.None);

        var consumer = new UpdatedConsumer(mockHandler.Object, mockLogger.Object);

        // Act
        var act = () => consumer.Consume(mockContext.Object);

        // Assert
        await act.Should().NotThrowAsync();
        mockHandler.Verify(
            x => x.HandleAsync(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    /// <summary>
    /// Tests that UpdatedConsumer throws when handler fails.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task UpdatedConsumer_WhenHandlerFails_ThrowsInvalidOperationException()
    {
        // Arrange
        var mockHandler = new Mock<ISubs.IUpdatedHandler>();
        mockHandler
            .Setup(x => x.HandleAsync(It.IsAny<GeoRefDataUpdated>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(D2Result<ISubs.UpdatedOutput?>.Fail(
                ["Handler failed"],
                HttpStatusCode.InternalServerError));

        var mockLogger = new Mock<ILogger<UpdatedConsumer>>();
        var mockContext = new Mock<ConsumeContext<GeoRefDataUpdated>>();
        mockContext.Setup(x => x.Message).Returns(new GeoRefDataUpdated("1.0.0"));
        mockContext.Setup(x => x.CancellationToken).Returns(CancellationToken.None);

        var consumer = new UpdatedConsumer(mockHandler.Object, mockLogger.Object);

        // Act
        var act = () => consumer.Consume(mockContext.Object);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
