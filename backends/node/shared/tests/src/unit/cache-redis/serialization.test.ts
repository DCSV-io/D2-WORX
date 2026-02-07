import { describe, it, expect } from "vitest";
import { JsonCacheSerializer } from "@d2/cache-redis";

describe("JsonCacheSerializer", () => {
  const serializer = new JsonCacheSerializer<unknown>();

  it("should roundtrip a string", () => {
    const serialized = serializer.serialize("hello");
    const deserialized = serializer.deserialize(Buffer.from(serialized as string));
    expect(deserialized).toBe("hello");
  });

  it("should roundtrip a number", () => {
    const serialized = serializer.serialize(42);
    const deserialized = serializer.deserialize(Buffer.from(serialized as string));
    expect(deserialized).toBe(42);
  });

  it("should roundtrip null", () => {
    const serialized = serializer.serialize(null);
    const deserialized = serializer.deserialize(Buffer.from(serialized as string));
    expect(deserialized).toBeNull();
  });

  it("should roundtrip a boolean", () => {
    const serialized = serializer.serialize(false);
    const deserialized = serializer.deserialize(Buffer.from(serialized as string));
    expect(deserialized).toBe(false);
  });

  it("should roundtrip an array", () => {
    const serialized = serializer.serialize([1, "two", null]);
    const deserialized = serializer.deserialize(Buffer.from(serialized as string));
    expect(deserialized).toEqual([1, "two", null]);
  });

  it("should roundtrip a nested object", () => {
    const obj = { user: { name: "test", scores: [10, 20] } };
    const serialized = serializer.serialize(obj);
    const deserialized = serializer.deserialize(Buffer.from(serialized as string));
    expect(deserialized).toEqual(obj);
  });

  it("should serialize to a JSON string", () => {
    const result = serializer.serialize({ key: "value" });
    expect(typeof result).toBe("string");
    expect(JSON.parse(result as string)).toEqual({ key: "value" });
  });

  it("should throw on invalid JSON during deserialize", () => {
    expect(() => serializer.deserialize(Buffer.from("not-json{{{"))).toThrow();
  });
});
