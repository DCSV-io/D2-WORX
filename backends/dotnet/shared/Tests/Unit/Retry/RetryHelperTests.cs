// -----------------------------------------------------------------------
// <copyright file="RetryHelperTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable ParameterOnlyUsedForPreconditionCheck.Local
namespace D2.Shared.Tests.Unit.Retry;

using D2.Shared.Utilities.Retry;

/// <summary>
/// Unit tests for <see cref="RetryHelper"/>.
/// </summary>
public class RetryHelperTests
{
    private readonly List<TimeSpan> r_delays = [];

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region IsTransientException

    /// <summary>
    /// Tests that HttpRequestException with 503 is transient.
    /// </summary>
    [Fact]
    public void IsTransientException_HttpRequestException503_ReturnsTrue()
    {
        var ex = new HttpRequestException("Service Unavailable", null, HttpStatusCode.ServiceUnavailable);
        Assert.True(RetryHelper.IsTransientException(ex));
    }

    /// <summary>
    /// Tests that HttpRequestException with 429 is transient.
    /// </summary>
    [Fact]
    public void IsTransientException_HttpRequestException429_ReturnsTrue()
    {
        var ex = new HttpRequestException("Too Many Requests", null, HttpStatusCode.TooManyRequests);
        Assert.True(RetryHelper.IsTransientException(ex));
    }

    /// <summary>
    /// Tests that HttpRequestException with 408 is transient.
    /// </summary>
    [Fact]
    public void IsTransientException_HttpRequestException408_ReturnsTrue()
    {
        var ex = new HttpRequestException("Request Timeout", null, HttpStatusCode.RequestTimeout);
        Assert.True(RetryHelper.IsTransientException(ex));
    }

    /// <summary>
    /// Tests that HttpRequestException with 404 is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientException_HttpRequestException404_ReturnsFalse()
    {
        var ex = new HttpRequestException("Not Found", null, HttpStatusCode.NotFound);
        Assert.False(RetryHelper.IsTransientException(ex));
    }

    /// <summary>
    /// Tests that TimeoutException is transient.
    /// </summary>
    [Fact]
    public void IsTransientException_TimeoutException_ReturnsTrue()
    {
        Assert.True(RetryHelper.IsTransientException(new TimeoutException()));
    }

    /// <summary>
    /// Tests that TaskCanceledException is transient.
    /// </summary>
    [Fact]
    public void IsTransientException_TaskCanceledException_ReturnsTrue()
    {
        Assert.True(RetryHelper.IsTransientException(new TaskCanceledException()));
    }

    /// <summary>
    /// Tests that SocketException is transient.
    /// </summary>
    [Fact]
    public void IsTransientException_SocketException_ReturnsTrue()
    {
        Assert.True(RetryHelper.IsTransientException(new System.Net.Sockets.SocketException()));
    }

    /// <summary>
    /// Tests that a regular Exception is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientException_RegularException_ReturnsFalse()
    {
        Assert.False(RetryHelper.IsTransientException(new InvalidOperationException()));
    }

    #endregion

    #region Exception handling

    /// <summary>
    /// Tests that it succeeds on first attempt with no retries needed.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_SucceedsOnFirstAttempt()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await RetryHelper.RetryAsync(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult("ok");
            },
            new RetryOptions<string> { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Equal("ok", result);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that it retries on transient exceptions and succeeds on the 3rd attempt.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_RetriesTransientError_SucceedsOnThirdAttempt()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                callCount++;
                if (attempt < 3)
                {
                    throw new TimeoutException();
                }

                return ValueTask.FromResult("ok");
            },
            new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Equal("ok", result);
        Assert.Equal(3, callCount);
        Assert.Equal(2, r_delays.Count);
    }

    /// <summary>
    /// Tests that it does NOT retry on permanent exceptions.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_DoesNotRetryPermanentError()
    {
        // Arrange
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) =>
                {
                    callCount++;
                    throw new InvalidOperationException("permanent");
                },
                new RetryOptions<string> { MaxAttempts = 3, DelayFunc = MockDelay },
                Ct);
        });

        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that it exhausts all attempts on transient errors and throws the last error.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_ExhaustsAllAttempts_ThrowsLastError()
    {
        // Arrange
        var callCount = 0;

        // Act & Assert
        var ex = await Assert.ThrowsAsync<TimeoutException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (attempt, _) =>
                {
                    callCount++;
                    throw new TimeoutException($"timeout-{attempt}");
                },
                new RetryOptions<string> { MaxAttempts = 3, DelayFunc = MockDelay },
                Ct);
        });

        Assert.Equal(3, callCount);
        Assert.Equal("timeout-3", ex.Message);
        Assert.Equal(2, r_delays.Count);
    }

    #endregion

    #region Return value inspection

    /// <summary>
    /// Tests that it retries when ShouldRetry returns true and succeeds on the 3rd attempt.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_ShouldRetry_SucceedsOnThirdAttempt()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                callCount++;
                return ValueTask.FromResult(attempt < 3 ? "retry" : "done");
            },
            new RetryOptions<string>
            {
                MaxAttempts = 5,
                ShouldRetry = r => r == "retry",
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.Equal("done", result);
        Assert.Equal(3, callCount);
        Assert.Equal(2, r_delays.Count);
    }

    /// <summary>
    /// Tests that it returns immediately when ShouldRetry returns false.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_ShouldRetryFalse_ReturnsImmediately()
    {
        // Act
        var result = await RetryHelper.RetryAsync(
            (_, _) => ValueTask.FromResult("good"),
            new RetryOptions<string>
            {
                MaxAttempts = 5,
                ShouldRetry = _ => false,
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.Equal("good", result);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that it returns the last bad result after all attempts are exhausted.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_ShouldRetry_ExhaustsAttempts_ReturnsLastResult()
    {
        // Act
        var result = await RetryHelper.RetryAsync(
            (attempt, _) => ValueTask.FromResult($"bad-{attempt}"),
            new RetryOptions<string>
            {
                MaxAttempts = 3,
                ShouldRetry = _ => true,
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.Equal("bad-3", result);
    }

    /// <summary>
    /// Tests that without ShouldRetry, any return value is accepted.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_WithoutShouldRetry_AcceptsAnyReturn()
    {
        // Act
        var result = await RetryHelper.RetryAsync(
            (_, _) => ValueTask.FromResult<string?>(null),
            new RetryOptions<string?> { DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Null(result);
    }

    #endregion

    #region Configuration

    /// <summary>
    /// Tests that jitter=false produces exact calculated delays.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_JitterFalse_ProducesExactDelays()
    {
        // Act
        await Assert.ThrowsAsync<TimeoutException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) => throw new TimeoutException(),
                new RetryOptions<string>
                {
                    MaxAttempts = 3,
                    BaseDelayMs = 100,
                    BackoffMultiplier = 2,
                    Jitter = false,
                    DelayFunc = MockDelay,
                },
                Ct);
        });

        // Assert
        // Retry 0: 100 * 2^0 = 100ms
        // Retry 1: 100 * 2^1 = 200ms
        Assert.Equal(TimeSpan.FromMilliseconds(100), r_delays[0]);
        Assert.Equal(TimeSpan.FromMilliseconds(200), r_delays[1]);
    }

    /// <summary>
    /// Tests that jitter=true produces delays within [0, calculated) range.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_JitterTrue_ProducesDelayInRange()
    {
        // Act
        await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                if (attempt < 2)
                {
                    throw new TimeoutException();
                }

                return ValueTask.FromResult("ok");
            },
            new RetryOptions<string>
            {
                MaxAttempts = 3,
                BaseDelayMs = 1000,
                BackoffMultiplier = 2,
                Jitter = true,
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        // First retry: calculated = min(1000 * 2^0, 30000) = 1000ms
        // With jitter: [0, 1000ms)
        Assert.True(r_delays[0] >= TimeSpan.Zero);
        Assert.True(r_delays[0] < TimeSpan.FromMilliseconds(1000));
    }

    /// <summary>
    /// Tests that maxDelayMs caps the delay.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_RespectsMaxDelayMs()
    {
        // Act
        await Assert.ThrowsAsync<TimeoutException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) => throw new TimeoutException(),
                new RetryOptions<string>
                {
                    MaxAttempts = 3,
                    BaseDelayMs = 1000,
                    BackoffMultiplier = 100,
                    MaxDelayMs = 5000,
                    Jitter = false,
                    DelayFunc = MockDelay,
                },
                Ct);
        });

        // Assert
        // Retry 0: min(1000 * 100^0, 5000) = 1000
        // Retry 1: min(1000 * 100^1, 5000) = 5000 (capped)
        Assert.Equal(TimeSpan.FromMilliseconds(1000), r_delays[0]);
        Assert.Equal(TimeSpan.FromMilliseconds(5000), r_delays[1]);
    }

    /// <summary>
    /// Tests that a custom IsTransient predicate controls exception retry behavior.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_CustomIsTransient_ControlsRetry()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                callCount++;
                if (attempt < 2)
                {
                    throw new InvalidOperationException("custom-transient");
                }

                return ValueTask.FromResult("ok");
            },
            new RetryOptions<string>
            {
                MaxAttempts = 3,
                IsTransient = ex => ex is InvalidOperationException { Message: "custom-transient" },
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.Equal("ok", result);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that the 1-based attempt number is passed to the operation.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_PassesAttemptNumber()
    {
        // Arrange
        List<int> attempts = [];

        // Act
        await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                attempts.Add(attempt);
                if (attempt < 3)
                {
                    throw new TimeoutException();
                }

                return ValueTask.FromResult("ok");
            },
            new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Equal([1, 2, 3], attempts);
    }

    /// <summary>
    /// Tests that cancellation stops the retry loop.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_CancellationStopsRetry()
    {
        // Arrange
        using var cts = new CancellationTokenSource();
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<OperationCanceledException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) =>
                {
                    callCount++;
                    cts.Cancel();
                    throw new TimeoutException();
                },
                new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
                cts.Token);
        });

        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that maxAttempts=1 runs a single attempt with no retries.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_MaxAttempts1_SingleAttemptNoRetry()
    {
        // Arrange
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<TimeoutException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) =>
                {
                    callCount++;
                    throw new TimeoutException("transient");
                },
                new RetryOptions<string> { MaxAttempts = 1, DelayFunc = MockDelay },
                Ct);
        });

        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that OperationCanceledException is not retried (not transient).
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_OperationCanceledException_NotRetried()
    {
        // Arrange
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<OperationCanceledException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) =>
                {
                    callCount++;
                    throw new OperationCanceledException();
                },
                new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
                Ct);
        });

        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that TaskCanceledException (HttpClient timeout) is retried when
    /// the user's CancellationToken is NOT canceled.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_TaskCanceledException_WhenTokenNotCanceled_Retries()
    {
        // Arrange — simulates HttpClient timeout (TaskCanceledException without user cancellation)
        var callCount = 0;

        // Act
        var result = await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                callCount++;
                if (attempt < 3)
                {
                    throw new TaskCanceledException("The request was canceled due to timeout.");
                }

                return ValueTask.FromResult("ok");
            },
            new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Equal("ok", result);
        Assert.Equal(3, callCount);
        Assert.Equal(2, r_delays.Count);
    }

    /// <summary>
    /// Tests that TaskCanceledException propagates immediately when the user's
    /// CancellationToken IS canceled (true user cancellation, not timeout).
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_TaskCanceledException_WhenTokenCanceled_PropagatesImmediately()
    {
        // Arrange
        using var cts = new CancellationTokenSource();
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<TaskCanceledException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) =>
                {
                    callCount++;
                    cts.Cancel();
                    throw new TaskCanceledException("User canceled.");
                },
                new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
                cts.Token);
        });

        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that OperationCanceledException propagates immediately when the
    /// user's CancellationToken IS canceled.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_OperationCanceledException_WhenTokenCanceled_PropagatesImmediately()
    {
        // Arrange
        using var cts = new CancellationTokenSource();
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<OperationCanceledException>(async () =>
        {
            await RetryHelper.RetryAsync(
                (_, _) =>
                {
                    callCount++;
                    cts.Cancel();
                    throw new OperationCanceledException(cts.Token);
                },
                new RetryOptions<string> { MaxAttempts = 5, DelayFunc = MockDelay },
                cts.Token);
        });

        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that null options uses sensible defaults.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_NullOptions_UsesDefaults()
    {
        // Act
        var result = await RetryHelper.RetryAsync(
            (_, _) => ValueTask.FromResult("ok"),
            ct: Ct);

        // Assert
        Assert.Equal("ok", result);
    }

    #endregion

    #region IsTransientException edge cases

    /// <summary>
    /// Tests that HttpRequestException with null StatusCode is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientException_HttpRequestExceptionNullStatusCode_ReturnsFalse()
    {
        var ex = new HttpRequestException("connection failed");
        Assert.False(RetryHelper.IsTransientException(ex));
    }

    #endregion

    #region Mixed scenarios

    /// <summary>
    /// Tests throw on attempt 1, bad return on attempt 2, success on attempt 3.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryAsync_MixedThrowAndBadReturn_SucceedsOnThird()
    {
        // Act
        var result = await RetryHelper.RetryAsync(
            (attempt, _) =>
            {
                if (attempt == 1)
                {
                    throw new TimeoutException();
                }

                return ValueTask.FromResult(attempt == 2 ? "retry-me" : "done");
            },
            new RetryOptions<string>
            {
                MaxAttempts = 5,
                ShouldRetry = r => r == "retry-me",
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.Equal("done", result);
    }

    #endregion

    #region Helpers

    private Task MockDelay(TimeSpan delay, CancellationToken ct)
    {
        r_delays.Add(delay);
        return Task.CompletedTask;
    }

    #endregion
}
