import { createServiceKey } from "@d2/di";
import type { ILogger } from "./i-logger.js";

/** DI key for the logger (singleton). */
export const ILoggerKey = createServiceKey<ILogger>("ILogger");
