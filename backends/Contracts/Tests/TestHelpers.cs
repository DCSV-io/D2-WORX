// -----------------------------------------------------------------------
// <copyright file="TestHelpers.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Tests;

using D2.Contracts.Handler;
using Microsoft.Extensions.Logging;
using Moq;

/// <summary>
/// Helper methods for tests.
/// </summary>
public static class TestHelpers
{
    /// <summary>
    /// Creates a mock handler context for testing.
    /// </summary>
    ///
    /// <returns>
    /// A mock <see cref="IHandlerContext"/> instance.
    /// </returns>
    public static IHandlerContext CreateHandlerContext()
    {
        var mockContext = new Mock<IRequestContext>();
        mockContext.Setup(x => x.TraceId).Returns(Guid.NewGuid().ToString());

        var mockLogger = new Mock<ILogger>();

        return new HandlerContext(mockContext.Object, mockLogger.Object);
    }
}
