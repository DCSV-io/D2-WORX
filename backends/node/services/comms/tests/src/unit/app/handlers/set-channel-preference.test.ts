import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { SetChannelPreference } from "@d2/comms-app";
import { createChannelPreference } from "@d2/comms-domain";
import { createMockContext, createMockChannelPrefRepo } from "../helpers/mock-handlers.js";

const TEST_USER_ID = "01961234-5678-7def-abcd-000000000001";

describe("SetChannelPreference", () => {
  it("should create a new preference when none exists", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext());

    const result = await handler.handleAsync({
      userId: TEST_USER_ID,
      emailEnabled: true,
      smsEnabled: false,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.userId).toBe(TEST_USER_ID);
    expect(result.data!.pref.smsEnabled).toBe(false);
    expect(repo.create.handleAsync).toHaveBeenCalledOnce();
    expect(repo.update.handleAsync).not.toHaveBeenCalled();
  });

  it("should update an existing preference", async () => {
    const existing = createChannelPreference({
      userId: TEST_USER_ID,
      emailEnabled: true,
      smsEnabled: true,
    });

    const repo = createMockChannelPrefRepo();
    (repo.findByUserId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: existing } }),
    );

    const handler = new SetChannelPreference(repo, createMockContext());

    const result = await handler.handleAsync({
      userId: TEST_USER_ID,
      smsEnabled: false,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.smsEnabled).toBe(false);
    expect(result.data!.pref.emailEnabled).toBe(true); // preserved
    expect(repo.update.handleAsync).toHaveBeenCalledOnce();
    expect(repo.create.handleAsync).not.toHaveBeenCalled();
  });

  it("should fail validation when no userId or contactId", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext());

    const result = await handler.handleAsync({
      emailEnabled: true,
    });

    expect(result.success).toBe(false);
  });
});
