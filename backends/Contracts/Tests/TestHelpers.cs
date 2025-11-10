using Common.Infra.Handler;
using D2.Contracts.Common;
using D2.Contracts.Common.App;
using Microsoft.Extensions.Logging;
using Moq;

namespace D2.Contracts.Tests;

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
