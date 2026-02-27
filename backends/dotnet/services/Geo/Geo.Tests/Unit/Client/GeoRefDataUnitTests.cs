// -----------------------------------------------------------------------
// <copyright file="GeoRefDataUnitTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable RedundantCapturedContext
namespace D2.Geo.Tests.Unit.Client;

using System.Net;
using D2.Events.Protos.V1;
using D2.Geo.Client.Interfaces.CQRS.Handlers.C;
using D2.Geo.Client.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Geo.Client.Messaging.Handlers.Sub;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Moq;
using Xunit;

/// <summary>
/// Unit tests for GeoRefData handlers and consumers.
/// </summary>
public class GeoRefDataUnitTests
{
    private readonly Mock<IComplex.IGetHandler> r_getHandler = new();
    private readonly Mock<IQueries.IGetFromDistHandler> r_getFromDist = new();
    private readonly Mock<ICommands.ISetInMemHandler> r_setInMem = new();
    private readonly Mock<ICommands.ISetOnDiskHandler> r_setOnDisk = new();
    private readonly IHandlerContext r_context = ClientTestHelpers.CreateHandlerContext();

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
        var testData = ClientTestHelpers.TestGeoRefData;

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

        var message = new GeoRefDataUpdatedEvent { Version = "2.0.0" };

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
        var testData = ClientTestHelpers.TestGeoRefData;

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

        var message = new GeoRefDataUpdatedEvent { Version = "2.0.0" };

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
        var testData = ClientTestHelpers.TestGeoRefData;

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

        var message = new GeoRefDataUpdatedEvent { Version = "2.0.0" };

        // Act
        var result = await handler.HandleAsync(message, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }
}
