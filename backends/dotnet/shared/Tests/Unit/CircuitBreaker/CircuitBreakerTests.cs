// -----------------------------------------------------------------------
// <copyright file="CircuitBreakerTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.CircuitBreaker;

using D2.Shared.Utilities.CircuitBreaker;
using FluentAssertions;

/// <summary>
/// Unit tests for <see cref="CircuitBreaker{T}"/>.
/// </summary>
public class CircuitBreakerTests
{
    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Initial State

    /// <summary>
    /// Tests that a new circuit breaker starts in the Closed state.
    /// </summary>
    [Fact]
    public void NewCircuitBreaker_StartsInClosedState()
    {
        var cb = new CircuitBreaker<int>(_ => false);

        cb.State.Should().Be(CircuitState.Closed);
        cb.FailureCount.Should().Be(0);
    }

    #endregion

    #region Closed State

    /// <summary>
    /// Tests that successful operations pass through in closed state.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenClosed_PassesThrough()
    {
        var cb = new CircuitBreaker<string>(_ => false);

        var result = await cb.ExecuteAsync(_ => ValueTask.FromResult("ok"), ct: Ct);

        result.Should().Be("ok");
        cb.State.Should().Be(CircuitState.Closed);
        cb.FailureCount.Should().Be(0);
    }

    /// <summary>
    /// Tests that consecutive failures increment the failure count.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenExceptionThrown_IncrementsFailureCount()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 5 });

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException("fail"), ct: Ct));

        cb.FailureCount.Should().Be(1);
        cb.State.Should().Be(CircuitState.Closed);
    }

    /// <summary>
    /// Tests that a success after failures resets the failure count.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_SuccessAfterFailures_ResetsCount()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 5 });
        var callCount = 0;

        // Two failures
        for (var i = 0; i < 2; i++)
        {
            await Assert.ThrowsAsync<InvalidOperationException>(async () =>
                await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
        }

        cb.FailureCount.Should().Be(2);

        // One success
        await cb.ExecuteAsync(_ =>
        {
            callCount++;
            return ValueTask.FromResult("ok");
        }, ct: Ct);

        cb.FailureCount.Should().Be(0);
        cb.State.Should().Be(CircuitState.Closed);
        callCount.Should().Be(1);
    }

    /// <summary>
    /// Tests that result-based failures also increment the failure count.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenResultIsFailure_IncrementsFailureCount()
    {
        var cb = new CircuitBreaker<int>(
            result => result < 0,
            new CircuitBreakerOptions { FailureThreshold = 3 });

        var result = await cb.ExecuteAsync(_ => ValueTask.FromResult(-1), ct: Ct);

        result.Should().Be(-1);
        cb.FailureCount.Should().Be(1);
    }

    #endregion

    #region Opening the Circuit

    /// <summary>
    /// Tests that reaching the failure threshold opens the circuit.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenThresholdReached_OpensCircuit()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 3 });

        for (var i = 0; i < 3; i++)
        {
            await Assert.ThrowsAsync<InvalidOperationException>(async () =>
                await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
        }

        cb.State.Should().Be(CircuitState.Open);
        cb.FailureCount.Should().Be(3);
    }

    /// <summary>
    /// Tests that threshold=1 opens the circuit on the very first failure.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenThreshold1_OpensOnFirstFailure()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 1 });

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        cb.State.Should().Be(CircuitState.Open);
    }

    /// <summary>
    /// Tests that result-based failures can also open the circuit.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_ResultFailures_OpenCircuit()
    {
        var cb = new CircuitBreaker<int>(
            result => result == -1,
            new CircuitBreakerOptions { FailureThreshold = 2 });

        await cb.ExecuteAsync(_ => ValueTask.FromResult(-1), ct: Ct);
        await cb.ExecuteAsync(_ => ValueTask.FromResult(-1), ct: Ct);

        cb.State.Should().Be(CircuitState.Open);
    }

    #endregion

    #region Open State

    /// <summary>
    /// Tests that calls are rejected when the circuit is open.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenOpen_ThrowsCircuitOpenException()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 1 });

        // Open the circuit
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        // Next call should throw CircuitOpenException
        await Assert.ThrowsAsync<CircuitOpenException>(async () =>
            await cb.ExecuteAsync(_ => ValueTask.FromResult("should not run"), ct: Ct));
    }

    /// <summary>
    /// Tests that the fallback is called when the circuit is open.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenOpenWithFallback_ReturnsFallback()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 1 });

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        var result = await cb.ExecuteAsync(
            _ => ValueTask.FromResult("should not run"),
            () => ValueTask.FromResult("fallback"),
            ct: Ct);

        result.Should().Be("fallback");
    }

    /// <summary>
    /// Tests that the operation is NOT invoked when the circuit is open.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenOpen_DoesNotInvokeOperation()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 1 });
        var operationCalled = false;

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        try
        {
            await cb.ExecuteAsync(_ =>
            {
                operationCalled = true;
                return ValueTask.FromResult("nope");
            }, ct: Ct);
        }
        catch (CircuitOpenException)
        {
            // Expected
        }

        operationCalled.Should().BeFalse();
    }

    #endregion

    #region Cooldown and Half-Open

    /// <summary>
    /// Tests that the circuit transitions to HalfOpen after the cooldown period.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_AfterCooldown_TransitionsToHalfOpen()
    {
        var now = 1000L;
        var cb = new CircuitBreaker<string>(
            _ => false,
            new CircuitBreakerOptions
            {
                FailureThreshold = 1,
                CooldownDuration = TimeSpan.FromSeconds(10),
                NowFunc = () => now,
            });

        // Open the circuit at t=1000
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
        cb.State.Should().Be(CircuitState.Open);

        // Advance time past cooldown (10000ms)
        now = 12000;

        // Next call should succeed — circuit transitions to HalfOpen and allows probe
        var result = await cb.ExecuteAsync(_ => ValueTask.FromResult("recovered"), ct: Ct);

        result.Should().Be("recovered");
        cb.State.Should().Be(CircuitState.Closed);
    }

    /// <summary>
    /// Tests that a failed probe in HalfOpen state reopens the circuit.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenHalfOpenProbeFails_ReopensCircuit()
    {
        var now = 1000L;
        var cb = new CircuitBreaker<string>(
            _ => false,
            new CircuitBreakerOptions
            {
                FailureThreshold = 1,
                CooldownDuration = TimeSpan.FromSeconds(10),
                NowFunc = () => now,
            });

        // Open at t=1000
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        // Advance past cooldown
        now = 12000;

        // Probe fails
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException("probe failed"), ct: Ct));

        cb.State.Should().Be(CircuitState.Open, "failed probe should reopen the circuit");
    }

    /// <summary>
    /// Tests that result-based failure in HalfOpen also reopens the circuit.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_WhenHalfOpenResultFailure_ReopensCircuit()
    {
        var now = 1000L;
        var cb = new CircuitBreaker<int>(
            result => result < 0,
            new CircuitBreakerOptions
            {
                FailureThreshold = 1,
                CooldownDuration = TimeSpan.FromSeconds(10),
                NowFunc = () => now,
            });

        // Open at t=1000
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        // Advance past cooldown
        now = 12000;

        // Probe returns a failure result
        await cb.ExecuteAsync(_ => ValueTask.FromResult(-1), ct: Ct);

        cb.State.Should().Be(CircuitState.Open, "result-based failure in half-open should reopen");
    }

    /// <summary>
    /// Tests that before cooldown expires, the circuit stays open.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_BeforeCooldown_StaysOpen()
    {
        var now = 1000L;
        var cb = new CircuitBreaker<string>(
            _ => false,
            new CircuitBreakerOptions
            {
                FailureThreshold = 1,
                CooldownDuration = TimeSpan.FromSeconds(30),
                NowFunc = () => now,
            });

        // Open at t=1000
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        // Advance only 5 seconds (< 30s cooldown)
        now = 6000;

        await Assert.ThrowsAsync<CircuitOpenException>(async () =>
            await cb.ExecuteAsync(_ => ValueTask.FromResult("nope"), ct: Ct));

        cb.State.Should().Be(CircuitState.Open);
    }

    /// <summary>
    /// Tests that a failed probe resets the cooldown timer (must wait another full cooldown).
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_FailedProbe_ResetsCooldownTimer()
    {
        var now = 1000L;
        var cb = new CircuitBreaker<string>(
            _ => false,
            new CircuitBreakerOptions
            {
                FailureThreshold = 1,
                CooldownDuration = TimeSpan.FromSeconds(10),
                NowFunc = () => now,
            });

        // Open at t=1000
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        // Advance past cooldown (t=12000), probe fails
        now = 12000;
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException("probe"), ct: Ct));

        // Now at t=12000, circuit reopened. Advance only 5s (t=17000) — should still be open
        now = 17000;
        await Assert.ThrowsAsync<CircuitOpenException>(async () =>
            await cb.ExecuteAsync(_ => ValueTask.FromResult("nope"), ct: Ct));

        // Advance another 10s past the reopened timestamp (t=23000) — now should allow probe
        now = 23000;
        var result = await cb.ExecuteAsync(_ => ValueTask.FromResult("recovered"), ct: Ct);
        result.Should().Be("recovered");
        cb.State.Should().Be(CircuitState.Closed);
    }

    #endregion

    #region Reset

    /// <summary>
    /// Tests that Reset() restores the circuit to Closed state.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task Reset_WhenOpen_RestoresClosedState()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 1 });

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
        cb.State.Should().Be(CircuitState.Open);

        cb.Reset();

        cb.State.Should().Be(CircuitState.Closed);
        cb.FailureCount.Should().Be(0);

        // Should be able to execute normally again
        var result = await cb.ExecuteAsync(_ => ValueTask.FromResult("after reset"), ct: Ct);
        result.Should().Be("after reset");
    }

    #endregion

    #region State Change Callback

    /// <summary>
    /// Tests that the onStateChange callback fires on state transitions.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task OnStateChange_FiresOnTransitions()
    {
        var transitions = new List<(CircuitState From, CircuitState To)>();
        var now = 1000L;

        var cb = new CircuitBreaker<string>(
            _ => false,
            new CircuitBreakerOptions
            {
                FailureThreshold = 2,
                CooldownDuration = TimeSpan.FromSeconds(5),
                NowFunc = () => now,
            },
            onStateChange: (from, to) => transitions.Add((from, to)));

        // 2 failures → opens
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        // Advance past cooldown, succeed → closes
        now = 7000;
        await cb.ExecuteAsync(_ => ValueTask.FromResult("ok"), ct: Ct);

        transitions.Should().HaveCount(3);
        transitions[0].Should().Be((CircuitState.Closed, CircuitState.Open));
        transitions[1].Should().Be((CircuitState.Open, CircuitState.HalfOpen));
        transitions[2].Should().Be((CircuitState.HalfOpen, CircuitState.Closed));
    }

    /// <summary>
    /// Tests that no callback fires when staying in the same state.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task OnStateChange_DoesNotFireWhenStayingClosed()
    {
        var transitions = new List<(CircuitState, CircuitState)>();
        var cb = new CircuitBreaker<string>(
            _ => false,
            new CircuitBreakerOptions { FailureThreshold = 10 },
            onStateChange: (from, to) => transitions.Add((from, to)));

        await cb.ExecuteAsync(_ => ValueTask.FromResult("ok"), ct: Ct);
        await cb.ExecuteAsync(_ => ValueTask.FromResult("ok"), ct: Ct);

        transitions.Should().BeEmpty();
    }

    #endregion

    #region Edge Cases

    /// <summary>
    /// Tests that alternating success and failure does not open the circuit
    /// (consecutive failures are required).
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_AlternatingSuccessAndFailure_DoesNotOpen()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 3 });

        for (var i = 0; i < 10; i++)
        {
            if (i % 2 == 0)
            {
                await Assert.ThrowsAsync<InvalidOperationException>(async () =>
                    await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
            }
            else
            {
                await cb.ExecuteAsync(_ => ValueTask.FromResult("ok"), ct: Ct);
            }
        }

        cb.State.Should().Be(CircuitState.Closed, "alternating failures should not accumulate");
    }

    /// <summary>
    /// Tests that default options work correctly (threshold=5, cooldown=30s).
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_DefaultOptions_ThresholdOf5()
    {
        var cb = new CircuitBreaker<string>(_ => false);

        // 4 failures — should still be closed
        for (var i = 0; i < 4; i++)
        {
            await Assert.ThrowsAsync<InvalidOperationException>(async () =>
                await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));
        }

        cb.State.Should().Be(CircuitState.Closed);

        // 5th failure — should open
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await cb.ExecuteAsync(_ => throw new InvalidOperationException(), ct: Ct));

        cb.State.Should().Be(CircuitState.Open);
    }

    /// <summary>
    /// Tests that CancellationToken is passed through to the operation.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_PassesCancellationToken()
    {
        using var cts = new CancellationTokenSource();
        var cb = new CircuitBreaker<string>(_ => false);
        CancellationToken receivedToken = default;

        await cb.ExecuteAsync(
            ct =>
            {
                receivedToken = ct;
                return ValueTask.FromResult("ok");
            },
            ct: cts.Token);

        receivedToken.Should().Be(cts.Token);
    }

    /// <summary>
    /// Tests that the original exception type is preserved after recording the failure.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ExecuteAsync_PreservesOriginalExceptionType()
    {
        var cb = new CircuitBreaker<string>(_ => false, new CircuitBreakerOptions { FailureThreshold = 10 });

        var ex = await Assert.ThrowsAsync<ArgumentException>(async () =>
            await cb.ExecuteAsync(_ => throw new ArgumentException("bad arg"), ct: Ct));

        ex.Message.Should().Be("bad arg");
        cb.FailureCount.Should().Be(1);
    }

    #endregion
}
