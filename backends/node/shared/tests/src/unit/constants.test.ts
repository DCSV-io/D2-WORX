import { describe, it, expect } from "vitest";
import { GEO_REF_DATA_FILE_NAME } from "@d2/utilities";

describe("Constants", () => {
  it("GEO_REF_DATA_FILE_NAME is georefdata.bin", () => {
    expect(GEO_REF_DATA_FILE_NAME).toBe("georefdata.bin");
  });
});
