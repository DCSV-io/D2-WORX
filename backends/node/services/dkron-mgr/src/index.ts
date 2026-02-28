// -----------------------------------------------------------------------
// <copyright file="index.ts" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// Barrel export for testability. The service entry point is main.ts (not this file).
export { parseConfig, logConfig, type DkronMgrConfig } from "./config.js";
export { checkHealth, listJobs, upsertJob, deleteJob } from "./dkron-client.js";
export { getDesiredJobs } from "./job-definitions.js";
export { reconcile, buildComparableKey } from "./reconciler.js";
export type {
  JobFields,
  DesiredJob,
  DkronJob,
  ReconcileResult,
  ReconcileError,
} from "./types.js";
