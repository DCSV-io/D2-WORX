import { describe, it, expect, vi } from "vitest";
import { batchDelete } from "@d2/batch-pg";

describe("batchDelete", () => {
  it("should return 0 when selectBatch returns empty array immediately", async () => {
    const selectBatch = vi.fn().mockResolvedValue([]);
    const deleteBatch = vi.fn();

    const result = await batchDelete(selectBatch, deleteBatch, 500);

    expect(result).toBe(0);
    expect(selectBatch).toHaveBeenCalledOnce();
    expect(selectBatch).toHaveBeenCalledWith(500);
    expect(deleteBatch).not.toHaveBeenCalled();
  });

  it("should delete a single batch smaller than batchSize", async () => {
    const ids = ["a", "b", "c"];
    const selectBatch = vi.fn().mockResolvedValueOnce(ids).mockResolvedValueOnce([]);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete(selectBatch, deleteBatch, 500);

    expect(result).toBe(3);
    expect(selectBatch).toHaveBeenCalledOnce();
    expect(deleteBatch).toHaveBeenCalledOnce();
    expect(deleteBatch).toHaveBeenCalledWith(ids);
  });

  it("should loop when batch size equals batchSize (exact boundary)", async () => {
    const batch1 = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    const selectBatch = vi.fn().mockResolvedValueOnce(batch1).mockResolvedValueOnce([]);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete(selectBatch, deleteBatch, 500);

    expect(result).toBe(500);
    expect(selectBatch).toHaveBeenCalledTimes(2);
    expect(deleteBatch).toHaveBeenCalledOnce();
  });

  it("should handle multi-batch deletion (1200 items, batchSize=500)", async () => {
    const batch1 = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    const batch2 = Array.from({ length: 500 }, (_, i) => `id-${500 + i}`);
    const batch3 = Array.from({ length: 200 }, (_, i) => `id-${1000 + i}`);

    const selectBatch = vi
      .fn()
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce(batch3);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete(selectBatch, deleteBatch, 500);

    expect(result).toBe(1200);
    expect(selectBatch).toHaveBeenCalledTimes(3);
    expect(deleteBatch).toHaveBeenCalledTimes(3);
    expect(deleteBatch).toHaveBeenNthCalledWith(1, batch1);
    expect(deleteBatch).toHaveBeenNthCalledWith(2, batch2);
    expect(deleteBatch).toHaveBeenNthCalledWith(3, batch3);
  });

  it("should handle large volume (2500 items, batchSize=500)", async () => {
    const batches = Array.from({ length: 5 }, (_, batchIdx) =>
      Array.from({ length: 500 }, (_, i) => `id-${batchIdx * 500 + i}`),
    );

    const selectBatch = vi.fn();
    for (const batch of batches) {
      selectBatch.mockResolvedValueOnce(batch);
    }
    selectBatch.mockResolvedValueOnce([]);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete(selectBatch, deleteBatch, 500);

    expect(result).toBe(2500);
    expect(selectBatch).toHaveBeenCalledTimes(6);
    expect(deleteBatch).toHaveBeenCalledTimes(5);
  });

  it("should propagate error from selectBatch", async () => {
    const selectBatch = vi.fn().mockRejectedValue(new Error("DB read failed"));
    const deleteBatch = vi.fn();

    await expect(batchDelete(selectBatch, deleteBatch, 500)).rejects.toThrow("DB read failed");
    expect(deleteBatch).not.toHaveBeenCalled();
  });

  it("should propagate error from deleteBatch", async () => {
    const selectBatch = vi.fn().mockResolvedValueOnce(["id-1", "id-2"]);
    const deleteBatch = vi.fn().mockRejectedValue(new Error("FK constraint violation"));

    await expect(batchDelete(selectBatch, deleteBatch, 500)).rejects.toThrow(
      "FK constraint violation",
    );
  });

  it("should stop early when batch is smaller than batchSize (no extra select)", async () => {
    const selectBatch = vi.fn().mockResolvedValueOnce(["a", "b"]);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete(selectBatch, deleteBatch, 10);

    expect(result).toBe(2);
    expect(selectBatch).toHaveBeenCalledOnce();
    expect(deleteBatch).toHaveBeenCalledOnce();
  });

  it("should work with numeric IDs", async () => {
    const selectBatch = vi.fn().mockResolvedValueOnce([1, 2, 3]).mockResolvedValueOnce([]);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete<number>(selectBatch, deleteBatch, 500);

    expect(result).toBe(3);
    expect(deleteBatch).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("should pass correct batchSize to selectBatch", async () => {
    const selectBatch = vi.fn().mockResolvedValue([]);
    const deleteBatch = vi.fn();

    await batchDelete(selectBatch, deleteBatch, 100);

    expect(selectBatch).toHaveBeenCalledWith(100);
  });

  it("should handle batchSize of 1 (single item per batch)", async () => {
    const selectBatch = vi
      .fn()
      .mockResolvedValueOnce(["a"])
      .mockResolvedValueOnce(["b"])
      .mockResolvedValueOnce(["c"])
      .mockResolvedValueOnce([]);
    const deleteBatch = vi.fn().mockResolvedValue(undefined);

    const result = await batchDelete(selectBatch, deleteBatch, 1);

    expect(result).toBe(3);
    expect(selectBatch).toHaveBeenCalledTimes(4);
    expect(deleteBatch).toHaveBeenCalledTimes(3);
  });
});
