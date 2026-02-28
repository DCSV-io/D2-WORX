// -----------------------------------------------------------------------
// <copyright file="BatchDeleteTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.BatchPg;

using D2.Shared.Batch.Pg;
using FluentAssertions;
using Xunit;

/// <summary>
/// Unit tests for <see cref="BatchDelete.ExecuteAsync{TId}"/>.
/// Pure function tests with mocked select/delete callbacks.
/// </summary>
public class BatchDeleteTests
{
    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Dataset

    /// <summary>
    /// Verifies that an empty dataset returns zero without calling delete.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenSelectReturnsEmpty_ReturnsZero()
    {
        var selectCalls = 0;
        var deleteCalls = 0;

        var result = await BatchDelete.ExecuteAsync<int>(
            (_, _) =>
            {
                selectCalls++;
                return Task.FromResult(new List<int>());
            },
            (_, _) =>
            {
                deleteCalls++;
                return Task.CompletedTask;
            },
            ct: Ct);

        result.Should().Be(0);
        selectCalls.Should().Be(1);
        deleteCalls.Should().Be(0);
    }

    #endregion

    #region Single Batch (Fewer than batchSize)

    /// <summary>
    /// Verifies that fewer items than batch size are deleted in a single pass.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenFewerThanBatchSize_DeletesAllAndStops()
    {
        var ids = new List<int> { 1, 2, 3 };
        var selectCalls = 0;

        var result = await BatchDelete.ExecuteAsync<int>(
            (_, _) =>
            {
                selectCalls++;
                return Task.FromResult(selectCalls == 1 ? ids : []);
            },
            (batch, _) =>
            {
                batch.Should().BeEquivalentTo(ids);
                return Task.CompletedTask;
            },
            ct: Ct);

        result.Should().Be(3);
        selectCalls.Should().Be(1); // Stops after first batch (3 < 500)
    }

    #endregion

    #region Exact Boundary (batchSize items)

    /// <summary>
    /// Verifies that exactly batch-size items triggers a second select to confirm no more remain.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenExactlyBatchSize_LoopsForSecondSelect()
    {
        var batch = Enumerable.Range(1, 500).ToList();
        var selectCalls = 0;

        var result = await BatchDelete.ExecuteAsync<int>(
            (_, _) =>
            {
                selectCalls++;
                return Task.FromResult(selectCalls == 1 ? batch : []);
            },
            (_, _) => Task.CompletedTask,
            ct: Ct);

        result.Should().Be(500);
        selectCalls.Should().Be(2); // Second call returns empty
    }

    #endregion

    #region Multi-Batch

    /// <summary>
    /// Verifies that multiple batches are processed until fewer than batch size is returned.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WithMultipleBatches_DeletesAllRows()
    {
        var batch1 = Enumerable.Range(1, 500).ToList();
        var batch2 = Enumerable.Range(501, 500).ToList();
        var batch3 = Enumerable.Range(1001, 200).ToList();
        var selectCalls = 0;
        var deleteCalls = 0;

        var result = await BatchDelete.ExecuteAsync<int>(
            (_, _) =>
            {
                selectCalls++;
                return selectCalls switch
                {
                    1 => Task.FromResult(batch1),
                    2 => Task.FromResult(batch2),
                    3 => Task.FromResult(batch3),
                    _ => Task.FromResult(new List<int>()),
                };
            },
            (_, _) =>
            {
                deleteCalls++;
                return Task.CompletedTask;
            },
            ct: Ct);

        result.Should().Be(1200);
        selectCalls.Should().Be(3); // 500 + 500 + 200 (200 < 500, so stops)
        deleteCalls.Should().Be(3);
    }

    /// <summary>
    /// Verifies that a large volume (2500 items) is fully processed across multiple batches.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WithLargeVolume_DeletesAllBatches()
    {
        const int total_count = 2500;
        const int batch_size = 500;
        var selectCalls = 0;

        var result = await BatchDelete.ExecuteAsync<int>(
            (limit, _) =>
            {
                selectCalls++;
                var remaining = total_count - ((selectCalls - 1) * batch_size);
                var count = Math.Min(remaining, limit);
                return Task.FromResult(
                    count > 0
                        ? Enumerable.Range((selectCalls - 1) * batch_size, count).ToList()
                        : new List<int>());
            },
            (_, _) => Task.CompletedTask,
            batch_size,
            Ct);

        result.Should().Be(2500);
        selectCalls.Should().Be(6); // 5 full batches + 1 empty
    }

    #endregion

    #region Custom Batch Size

    /// <summary>
    /// Verifies that the custom batch size is forwarded to the select callback as the limit parameter.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WithCustomBatchSize_PassesCorrectLimit()
    {
        var receivedLimits = new List<int>();

        await BatchDelete.ExecuteAsync<int>(
            (limit, _) =>
            {
                receivedLimits.Add(limit);
                return Task.FromResult(new List<int>());
            },
            (_, _) => Task.CompletedTask,
            batchSize: 100,
            ct: Ct);

        receivedLimits.Should().ContainSingle().Which.Should().Be(100);
    }

    /// <summary>
    /// Verifies that a batch size of one processes items individually.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WithBatchSizeOfOne_ProcessesItemByItem()
    {
        var selectCalls = 0;
        var deleteCalls = 0;

        var result = await BatchDelete.ExecuteAsync<string>(
            (_, _) =>
            {
                selectCalls++;
                return selectCalls switch
                {
                    1 => Task.FromResult(new List<string> { "a" }),
                    2 => Task.FromResult(new List<string> { "b" }),
                    3 => Task.FromResult(new List<string> { "c" }),
                    _ => Task.FromResult(new List<string>()),
                };
            },
            (_, _) =>
            {
                deleteCalls++;
                return Task.CompletedTask;
            },
            batchSize: 1,
            ct: Ct);

        result.Should().Be(3);
        selectCalls.Should().Be(4); // 3 items + 1 empty
        deleteCalls.Should().Be(3);
    }

    #endregion

    #region Error Propagation

    /// <summary>
    /// Verifies that exceptions from the select callback propagate to the caller.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenSelectBatchThrows_Propagates()
    {
        var act = () => BatchDelete.ExecuteAsync<int>(
            (_, _) => throw new InvalidOperationException("DB read failed"),
            (_, _) => Task.CompletedTask,
            ct: Ct);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("DB read failed");
    }

    /// <summary>
    /// Verifies that exceptions from the delete callback propagate to the caller.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenDeleteBatchThrows_Propagates()
    {
        var act = () => BatchDelete.ExecuteAsync<int>(
            (_, _) => Task.FromResult(new List<int> { 1, 2 }),
            (_, _) => throw new InvalidOperationException("FK constraint violation"),
            ct: Ct);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("FK constraint violation");
    }

    #endregion

    #region Cancellation

    /// <summary>
    /// Verifies that a pre-cancelled token throws before any work is done.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenCancelledBeforeStart_ThrowsOperationCancelled()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var act = () => BatchDelete.ExecuteAsync<int>(
            (_, _) => Task.FromResult(new List<int>()),
            (_, _) => Task.CompletedTask,
            ct: cts.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    /// <summary>
    /// Verifies that cancellation during the loop throws OperationCanceledException.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenCancelledDuringLoop_ThrowsOperationCancelled()
    {
        using var cts = new CancellationTokenSource();
        var selectCalls = 0;

        var act = () => BatchDelete.ExecuteAsync<int>(
            (_, _) =>
            {
                selectCalls++;
                if (selectCalls == 2)
                {
                    cts.Cancel();
                }

                return Task.FromResult(Enumerable.Range(1, 500).ToList());
            },
            (_, _) => Task.CompletedTask,
            ct: cts.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    #endregion

    #region Batch Size Validation

    /// <summary>
    /// Verifies that a zero batch size throws immediately.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenBatchSizeIsZero_ThrowsArgumentOutOfRange()
    {
        var act = () => BatchDelete.ExecuteAsync<int>(
            (_, _) => Task.FromResult(new List<int>()),
            (_, _) => Task.CompletedTask,
            batchSize: 0,
            ct: Ct);

        await act.Should().ThrowAsync<ArgumentOutOfRangeException>()
            .WithParameterName("batchSize");
    }

    /// <summary>
    /// Verifies that a negative batch size throws immediately.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WhenBatchSizeIsNegative_ThrowsArgumentOutOfRange()
    {
        var act = () => BatchDelete.ExecuteAsync<int>(
            (_, _) => Task.FromResult(new List<int>()),
            (_, _) => Task.CompletedTask,
            batchSize: -1,
            ct: Ct);

        await act.Should().ThrowAsync<ArgumentOutOfRangeException>()
            .WithParameterName("batchSize");
    }

    #endregion

    #region String IDs (Generic Type Verification)

    /// <summary>
    /// Verifies that the generic method works with string IDs (not just integers).
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task ExecuteAsync_WithStringIds_WorksCorrectly()
    {
        var ids = new List<string> { "abc", "def", "ghi" };
        List<string>? deletedBatch = null;

        var result = await BatchDelete.ExecuteAsync<string>(
            (_, _) => Task.FromResult(ids),
            (batch, _) =>
            {
                deletedBatch = batch;
                return Task.CompletedTask;
            },
            ct: Ct);

        result.Should().Be(3);
        deletedBatch.Should().BeEquivalentTo(ids);
    }

    #endregion
}
