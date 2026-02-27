// -----------------------------------------------------------------------
// <copyright file="D2RetryHelperTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Retry;

using D2.Shared.Result;
using D2.Shared.Result.Retry;

/// <summary>
/// Unit tests for <see cref="D2RetryHelper"/>.
/// </summary>
public class D2RetryHelperTests
{
    private readonly List<TimeSpan> r_delays = [];

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region IsTransientResult

    /// <summary>
    /// Tests that a successful result is not transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_Success_ReturnsFalse()
    {
        Assert.False(D2RetryHelper.IsTransientResult(D2Result.Ok()));
    }

    /// <summary>
    /// Tests that SERVICE_UNAVAILABLE is transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_ServiceUnavailable_ReturnsTrue()
    {
        var result = D2Result.Fail(
            errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
            statusCode: HttpStatusCode.ServiceUnavailable);
        Assert.True(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that UNHANDLED_EXCEPTION is transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_UnhandledException_ReturnsTrue()
    {
        var result = D2Result<string>.UnhandledException();
        Assert.True(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that RATE_LIMITED is transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_RateLimited_ReturnsTrue()
    {
        var result = D2Result.Fail(
            errorCode: ErrorCodes.RATE_LIMITED,
            statusCode: HttpStatusCode.TooManyRequests);
        Assert.True(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that CONFLICT is transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_Conflict_ReturnsTrue()
    {
        var result = D2Result<string>.Conflict();
        Assert.True(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that 5xx without error code is transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_5xxNoErrorCode_ReturnsTrue()
    {
        var result = D2Result.Fail(statusCode: HttpStatusCode.InternalServerError);
        Assert.True(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that NOT_FOUND is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_NotFound_ReturnsFalse()
    {
        Assert.False(D2RetryHelper.IsTransientResult(D2Result<string>.NotFound()));
    }

    /// <summary>
    /// Tests that UNAUTHORIZED is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_Unauthorized_ReturnsFalse()
    {
        Assert.False(D2RetryHelper.IsTransientResult(D2Result<string>.Unauthorized()));
    }

    /// <summary>
    /// Tests that FORBIDDEN is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_Forbidden_ReturnsFalse()
    {
        Assert.False(D2RetryHelper.IsTransientResult(D2Result<string>.Forbidden()));
    }

    /// <summary>
    /// Tests that VALIDATION_FAILED is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_ValidationFailed_ReturnsFalse()
    {
        Assert.False(D2RetryHelper.IsTransientResult(D2Result<string>.ValidationFailed()));
    }

    /// <summary>
    /// Tests that SOME_FOUND is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_SomeFound_ReturnsFalse()
    {
        Assert.False(D2RetryHelper.IsTransientResult(D2Result<string>.SomeFound()));
    }

    /// <summary>
    /// Tests that COULD_NOT_BE_SERIALIZED is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_CouldNotBeSerialized_ReturnsFalse()
    {
        var result = D2Result.Fail(errorCode: ErrorCodes.COULD_NOT_BE_SERIALIZED);
        Assert.False(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that COULD_NOT_BE_DESERIALIZED is NOT transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_CouldNotBeDeserialized_ReturnsFalse()
    {
        var result = D2Result.Fail(errorCode: ErrorCodes.COULD_NOT_BE_DESERIALIZED);
        Assert.False(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that ErrorCode takes precedence over StatusCode (NOT_FOUND + 500 → not transient).
    /// </summary>
    [Fact]
    public void IsTransientResult_ErrorCodePrecedence_NotFoundWith500_ReturnsFalse()
    {
        var result = D2Result.Fail(
            errorCode: ErrorCodes.NOT_FOUND,
            statusCode: HttpStatusCode.InternalServerError);
        Assert.False(D2RetryHelper.IsTransientResult(result));
    }

    /// <summary>
    /// Tests that 429 without error code is transient.
    /// </summary>
    [Fact]
    public void IsTransientResult_429NoErrorCode_ReturnsTrue()
    {
        var result = D2Result.Fail(statusCode: HttpStatusCode.TooManyRequests);
        Assert.True(D2RetryHelper.IsTransientResult(result));
    }

    #endregion

    #region RetryResultAsync (clean)

    /// <summary>
    /// Tests that it returns immediately on successful result.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_Success_ReturnsImmediately()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.Ok("data"));
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal("data", result.Data);
        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that it retries SERVICE_UNAVAILABLE and succeeds.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_ServiceUnavailable_RetriesAndSucceeds()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (attempt, _) =>
            {
                callCount++;
                if (attempt < 2)
                {
                    return ValueTask.FromResult(D2Result<string>.Fail(
                        errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                        statusCode: HttpStatusCode.ServiceUnavailable));
                }

                return ValueTask.FromResult(D2Result<string>.Ok("ok"));
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal("ok", result.Data);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that it retries UNHANDLED_EXCEPTION and succeeds.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_UnhandledException_RetriesAndSucceeds()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (attempt, _) =>
            {
                callCount++;
                return attempt < 2
                    ? ValueTask.FromResult(D2Result<string>.UnhandledException())
                    : ValueTask.FromResult(D2Result<string>.Ok("ok"));
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that NOT_FOUND is NOT retried.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_NotFound_DoesNotRetry()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.NotFound());
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.NOT_FOUND, result.ErrorCode);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that UNAUTHORIZED is NOT retried.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_Unauthorized_DoesNotRetry()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.Unauthorized());
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that VALIDATION_FAILED is NOT retried.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_ValidationFailed_DoesNotRetry()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.ValidationFailed());
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that SOME_FOUND is NOT retried.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_SomeFound_DoesNotRetry()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.SomeFound());
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.SOME_FOUND, result.ErrorCode);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that it returns the last failed result after exhaustion.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_Exhaustion_ReturnsLastResult()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (attempt, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.UnhandledException([$"attempt {attempt}"]));
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Contains("attempt 3", result.Messages);
        Assert.Equal(3, callCount);
    }

    /// <summary>
    /// Tests that a custom IsTransientResult overrides the default.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_CustomIsTransient_OverridesDefault()
    {
        // Arrange — NOT_FOUND is normally NOT transient, but we override
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (attempt, _) =>
            {
                callCount++;
                return attempt < 2
                    ? ValueTask.FromResult(D2Result<string>.NotFound())
                    : ValueTask.FromResult(D2Result<string>.Ok("found"));
            },
            new D2RetryOptions
            {
                MaxAttempts = 3,
                IsTransientResult = r => r.ErrorCode == ErrorCodes.NOT_FOUND,
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that an operation that throws is caught and returns unhandledException.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_OperationThrows_CaughtAndRetried()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (attempt, _) =>
            {
                callCount++;
                if (attempt < 2)
                {
                    throw new InvalidOperationException("kaboom");
                }

                return ValueTask.FromResult(D2Result<string>.Ok("ok"));
            },
            new D2RetryOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert — unhandledException is transient, so it retries
        Assert.True(result.Success);
        Assert.Equal("ok", result.Data);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that maxAttempts=1 returns transient failure without retrying.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_MaxAttempts1_ReturnsWithoutRetrying()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult(D2Result<string>.UnhandledException());
            },
            new D2RetryOptions { MaxAttempts = 1, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.UNHANDLED_EXCEPTION, result.ErrorCode);
        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that cancellation stops the clean retry loop.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_CancellationStopsRetry()
    {
        // Arrange
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        // Act — pre-cancelled token: should return initial lastResult without calling operation
        var result = await D2RetryHelper.RetryResultAsync<string>(
            (_, _) => ValueTask.FromResult(D2Result<string>.Ok("should not reach")),
            new D2RetryOptions { MaxAttempts = 5, DelayFunc = MockDelay },
            cts.Token);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.CANCELLED, result.ErrorCode);
    }

    /// <summary>
    /// Tests that 1-based attempt number is passed to the operation.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryResultAsync_PassesAttemptNumber()
    {
        // Arrange
        List<int> attempts = [];

        // Act
        await D2RetryHelper.RetryResultAsync<string>(
            (attempt, _) =>
            {
                attempts.Add(attempt);
                return attempt < 3
                    ? ValueTask.FromResult(D2Result<string>.UnhandledException())
                    : ValueTask.FromResult(D2Result<string>.Ok());
            },
            new D2RetryOptions { MaxAttempts = 5, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Equal([1, 2, 3], attempts);
    }

    #endregion

    #region RetryExternalAsync (dirty)

    /// <summary>
    /// Tests that it maps raw response to D2Result via mapResult and returns on success.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_MapsSuccess_ReturnsImmediately()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult((200, "data"));
            },
            raw => D2Result<string>.Ok(raw.Body),
            new D2RetryExternalOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal("data", result.Data);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that it maps raw response to transient D2Result and retries.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_TransientMapped_Retries()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (attempt, _) =>
            {
                callCount++;
                return attempt < 2
                    ? ValueTask.FromResult((503, "down"))
                    : ValueTask.FromResult((200, "ok"));
            },
            raw => raw.Status == 200
                ? D2Result<string>.Ok(raw.Body)
                : D2Result<string>.Fail(
                    errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                    statusCode: HttpStatusCode.ServiceUnavailable),
            new D2RetryExternalOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal("ok", result.Data);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that it maps raw response to permanent D2Result and returns immediately.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_PermanentMapped_ReturnsImmediately()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult((404, "not found"));
            },
            _ => D2Result<string>.NotFound(),
            new D2RetryExternalOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.NOT_FOUND, result.ErrorCode);
        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that exception with default mapError produces unhandledException (transient, retries).
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_ExceptionDefaultMapError_Retries()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<string, string>(
            (attempt, _) =>
            {
                callCount++;
                if (attempt < 2)
                {
                    throw new InvalidOperationException("network failure");
                }

                return ValueTask.FromResult("ok");
            },
            raw => D2Result<string>.Ok(raw),
            new D2RetryExternalOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.True(result.Success);
        Assert.Equal("ok", result.Data);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that exception with custom mapError producing NOT_FOUND does not retry.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_CustomMapError_NotFound_DoesNotRetry()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<string, string>(
            (_, _) =>
            {
                callCount++;
                throw new InvalidOperationException("not found upstream");
            },
            _ => D2Result<string>.Ok(),
            new D2RetryExternalOptions
            {
                MaxAttempts = 3,
                MapError = _ => D2Result<string>.NotFound(),
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.NOT_FOUND, result.ErrorCode);
        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that it returns the last D2Result after exhaustion.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_Exhaustion_ReturnsLastResult()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult((503, "still down"));
            },
            _ => D2Result<string>.Fail(
                ["still down"],
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                statusCode: HttpStatusCode.ServiceUnavailable),
            new D2RetryExternalOptions { MaxAttempts = 3, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.SERVICE_UNAVAILABLE, result.ErrorCode);
        Assert.Contains("still down", result.Messages);
        Assert.Equal(3, callCount);
    }

    /// <summary>
    /// Tests backoff timing with jitter=false.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_JitterFalse_ProducesExactDelays()
    {
        // Act
        await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (attempt, _) => attempt < 3
                ? ValueTask.FromResult((503, "down"))
                : ValueTask.FromResult((200, "ok")),
            raw => raw.Status == 200
                ? D2Result<string>.Ok(raw.Body)
                : D2Result<string>.Fail(
                    errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                    statusCode: HttpStatusCode.ServiceUnavailable),
            new D2RetryExternalOptions
            {
                MaxAttempts = 5,
                BaseDelayMs = 100,
                BackoffMultiplier = 2,
                Jitter = false,
                DelayFunc = MockDelay,
            },
            Ct);

        // Assert
        // Retry 0: 100 * 2^0 = 100ms
        // Retry 1: 100 * 2^1 = 200ms
        Assert.Equal(TimeSpan.FromMilliseconds(100), r_delays[0]);
        Assert.Equal(TimeSpan.FromMilliseconds(200), r_delays[1]);
    }

    /// <summary>
    /// Tests that maxAttempts=1 returns transient failure without retrying.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_MaxAttempts1_ReturnsWithoutRetrying()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult((503, "down"));
            },
            _ => D2Result<string>.Fail(
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                statusCode: HttpStatusCode.ServiceUnavailable),
            new D2RetryExternalOptions { MaxAttempts = 1, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.SERVICE_UNAVAILABLE, result.ErrorCode);
        Assert.Equal(1, callCount);
        Assert.Empty(r_delays);
    }

    /// <summary>
    /// Tests that cancellation stops the dirty retry loop.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_CancellationStopsRetry()
    {
        // Arrange
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        // Act — pre-cancelled token: should return initial lastResult without calling operation
        var result = await D2RetryHelper.RetryExternalAsync<string, string>(
            (_, _) => ValueTask.FromResult("should not reach"),
            raw => D2Result<string>.Ok(raw),
            new D2RetryExternalOptions { MaxAttempts = 5, DelayFunc = MockDelay },
            cts.Token);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.CANCELLED, result.ErrorCode);
    }

    /// <summary>
    /// Tests that mapResult throwing is caught and treated as unhandledException.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_MapResultThrows_CaughtAsUnhandledException()
    {
        // Arrange
        var callCount = 0;

        // Act
        var result = await D2RetryHelper.RetryExternalAsync<string, string>(
            (_, _) =>
            {
                callCount++;
                return ValueTask.FromResult("data");
            },
            _ => throw new InvalidOperationException("mapResult failed"),
            new D2RetryExternalOptions { MaxAttempts = 2, DelayFunc = MockDelay },
            Ct);

        // Assert — mapResult throws → caught as unhandledException (transient) → retries → exhausts
        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.UNHANDLED_EXCEPTION, result.ErrorCode);
        Assert.Equal(2, callCount);
    }

    /// <summary>
    /// Tests that OperationCanceledException propagates through the dirty retrier.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_OperationCanceledException_Propagates()
    {
        // Arrange
        var callCount = 0;

        // Act & Assert
        await Assert.ThrowsAsync<OperationCanceledException>(async () =>
        {
            await D2RetryHelper.RetryExternalAsync<string, string>(
                (_, _) =>
                {
                    callCount++;
                    throw new OperationCanceledException();
                },
                raw => D2Result<string>.Ok(raw),
                new D2RetryExternalOptions { MaxAttempts = 5, DelayFunc = MockDelay },
                Ct);
        });

        Assert.Equal(1, callCount);
    }

    /// <summary>
    /// Tests that 1-based attempt number is passed to the operation.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RetryExternalAsync_PassesAttemptNumber()
    {
        // Arrange
        List<int> attempts = [];

        // Act
        await D2RetryHelper.RetryExternalAsync<(int Status, string Body), string>(
            (attempt, _) =>
            {
                attempts.Add(attempt);
                return attempt < 3
                    ? ValueTask.FromResult((503, "down"))
                    : ValueTask.FromResult((200, "ok"));
            },
            raw => raw.Status == 200
                ? D2Result<string>.Ok(raw.Body)
                : D2Result<string>.Fail(
                    errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                    statusCode: HttpStatusCode.ServiceUnavailable),
            new D2RetryExternalOptions { MaxAttempts = 5, DelayFunc = MockDelay },
            Ct);

        // Assert
        Assert.Equal([1, 2, 3], attempts);
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
