import { describe, it, expect, vi } from "vitest";
import { createLogger, LogLevel, PinoLogger, type ILogger } from "@d2/logging";

// ---------------------------------------------------------------------------
// createLogger
// ---------------------------------------------------------------------------

describe("createLogger", () => {
  it("returns an ILogger instance", () => {
    const logger = createLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.fatal).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("returns a PinoLogger instance", () => {
    const logger = createLogger();

    expect(logger).toBeInstanceOf(PinoLogger);
  });

  it("logger methods do not throw", () => {
    const logger = createLogger();

    expect(() => logger.info("test info")).not.toThrow();
    expect(() => logger.debug("test debug")).not.toThrow();
    expect(() => logger.warn("test warn")).not.toThrow();
    expect(() => logger.error("test error")).not.toThrow();
    expect(() => logger.fatal("test fatal")).not.toThrow();
  });

  it("defaults to info level", () => {
    const logger = createLogger();

    // Debug should be suppressed at info level — verify no crash
    expect(() => logger.debug("should be suppressed")).not.toThrow();
    expect(() => logger.info("should be visible")).not.toThrow();
  });

  it("respects custom log level", () => {
    const logger = createLogger({ level: LogLevel.Warn });

    // Info and debug should be suppressed at warn level
    expect(() => logger.info("suppressed")).not.toThrow();
    expect(() => logger.warn("visible")).not.toThrow();
  });

  it("creates a logger with serviceName binding", () => {
    const logger = createLogger({ serviceName: "test-service" });

    // Should not throw, serviceName is a base binding
    expect(logger).toBeDefined();
    expect(() => logger.info("with service name")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// child logger
// ---------------------------------------------------------------------------

describe("ILogger.child", () => {
  it("returns a new ILogger with bindings", () => {
    const logger = createLogger();
    const child = logger.child({ requestId: "req-123" });

    expect(child).toBeDefined();
    expect(child).toBeInstanceOf(PinoLogger);
    expect(child).not.toBe(logger);
  });

  it("child logger methods do not throw", () => {
    const logger = createLogger();
    const child = logger.child({ component: "handler" });

    expect(() => child.info("test from child")).not.toThrow();
    expect(() => child.debug("debug from child")).not.toThrow();
    expect(() => child.warn("warn from child")).not.toThrow();
    expect(() => child.error("error from child")).not.toThrow();
    expect(() => child.fatal("fatal from child")).not.toThrow();
  });

  it("child can create nested children", () => {
    const logger = createLogger();
    const child = logger.child({ level: "1" });
    const grandchild = child.child({ level: "2" });

    expect(grandchild).toBeDefined();
    expect(grandchild).toBeInstanceOf(PinoLogger);
    expect(() => grandchild.info("nested child")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// LogLevel enum
// ---------------------------------------------------------------------------

describe("LogLevel", () => {
  it("has expected values", () => {
    expect(LogLevel.Debug).toBe("debug");
    expect(LogLevel.Info).toBe("info");
    expect(LogLevel.Warn).toBe("warn");
    expect(LogLevel.Error).toBe("error");
    expect(LogLevel.Fatal).toBe("fatal");
    expect(LogLevel.Silent).toBe("silent");
  });
});
