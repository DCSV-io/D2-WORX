# Dkron Manager (`@d2/dkron-mgr`)

Continuously running Node.js service that reconciles desired Dkron job state against the live Dkron cluster. Replaces the manual `provision-jobs.sh` script.

## Architecture

This is a **flat** service (no DDD layers) — it has no business domain, no database, and no external API. It runs a reconciliation loop using Dkron's REST API.

```
┌─────────────┐     GET /v1/jobs       ┌───────────┐
│  dkron-mgr  │ ◄────────────────────► │   Dkron   │
│  (Node.js)  │     POST /v1/jobs      │  (4.0.9)  │
│             │     DELETE /v1/jobs/:n  │           │
└─────────────┘                        └───────────┘
     │                                       │
     │ resolves URLs + service key           │ fires HTTP POST
     │ from env vars                         │ on cron schedule
     │                                       ▼
     │                                 ┌───────────┐
     └────────────────────────────────►│  Gateway   │
           job definitions point to    │  (REST)   │
                                       └───────────┘
```

## How It Works

Every 5 minutes (configurable), the reconciler:

1. **Fetches** all jobs from Dkron via `GET /v1/jobs`
2. **Filters** to managed jobs (those with `metadata.managed_by = "d2-dkron-mgr"`)
3. **Compares** against desired job definitions (TypeScript, env-resolved)
4. **Creates** missing jobs via `POST /v1/jobs` (upsert)
5. **Updates** changed jobs via `POST /v1/jobs` (upsert)
6. **Deletes** orphaned managed jobs via `DELETE /v1/jobs/{name}`

### Managed Job Identification

All jobs created by this service include `metadata: { managed_by: "d2-dkron-mgr" }`. Only jobs with this tag are considered for reconciliation. Untagged jobs (manually created) are left untouched.

### Change Detection

Compares `displayname`, `schedule`, `timezone`, `executor`, `executor_config`, `concurrency`, `retries`, and `disabled`. Server-managed fields (`success_count`, `last_success`, `next`, etc.) are ignored.

## Files

| File                  | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `src/main.ts`         | Entry point — env parsing, health wait, loop   |
| `src/config.ts`       | Typed config from env vars + validation        |
| `src/types.ts`        | DkronJob, DesiredJob, ReconcileResult types     |
| `src/dkron-client.ts` | Thin `fetch` wrapper for Dkron REST API        |
| `src/job-definitions.ts` | Desired job state (single source of truth)  |
| `src/reconciler.ts`   | Core diff + sync logic                         |

## Configuration

| Env Var                            | Required | Default    | Purpose                                  |
| ---------------------------------- | -------- | ---------- | ---------------------------------------- |
| `DKRON_MGR__DKRON_URL`             | Yes      | —          | Dkron REST API base URL                  |
| `DKRON_MGR__GATEWAY_URL`           | Yes      | —          | Gateway URL (as seen from Dkron container) |
| `DKRON_MGR__SERVICE_KEY`           | Yes      | —          | X-Api-Key for Dkron → Gateway auth       |
| `DKRON_MGR__RECONCILE_INTERVAL_MS` | No       | `300000`   | Reconciliation loop interval (5 min)     |

**URL notes:**
- `DKRON_URL` is the host-side port (`http://localhost:8888`) since dkron-mgr runs on the host via tsx.
- `GATEWAY_URL` must be `http://host.docker.internal:5461` because Dkron runs inside Docker and needs to reach the gateway on the host.

## Adding / Removing / Modifying Jobs

Edit `src/job-definitions.ts` — the `getDesiredJobs()` function is the single source of truth.

- **Add a job:** Add a new entry to the returned array.
- **Remove a job:** Delete the entry. The reconciler will delete the orphaned job from Dkron on the next cycle.
- **Modify a job:** Change the fields. The reconciler will detect the change and update Dkron.

## Resilience

- **Dkron unavailable on startup:** Exponential backoff (1s → 2s → 4s → ... → 30s cap). Never gives up.
- **Dkron unavailable during cycle:** Error logged, next cycle retries normally.
- **Individual operation failure:** Each create/update/delete is independently try/caught. One failure doesn't block others.
- **Service never crashes** due to Dkron unavailability.

## Managed Jobs

| Job Name                            | Schedule         | Endpoint                                              |
| ----------------------------------- | ---------------- | ----------------------------------------------------- |
| `geo-purge-stale-whois`             | `0 0 2 * * *`   | `POST /api/v1/geo/jobs/purge-stale-whois`             |
| `geo-cleanup-orphaned-locations`    | `0 15 2 * * *`  | `POST /api/v1/geo/jobs/cleanup-orphaned-locations`    |
| `auth-purge-sessions`               | `0 30 2 * * *`  | `POST /api/v1/auth/jobs/purge-sessions`               |
| `auth-purge-sign-in-events`         | `0 45 2 * * *`  | `POST /api/v1/auth/jobs/purge-sign-in-events`         |
| `auth-cleanup-invitations`          | `0 0 3 * * *`   | `POST /api/v1/auth/jobs/cleanup-invitations`          |
| `auth-cleanup-emulation-consents`   | `0 15 3 * * *`  | `POST /api/v1/auth/jobs/cleanup-emulation-consents`   |
| `comms-purge-deleted-messages`      | `0 30 3 * * *`  | `POST /api/v1/comms/jobs/purge-deleted-messages`      |
| `comms-purge-delivery-history`      | `0 45 3 * * *`  | `POST /api/v1/comms/jobs/purge-delivery-history`      |

All daily, staggered by 15 minutes, UTC timezone. Geo WhoIs purge runs before orphaned location cleanup (deleting WhoIs may orphan locations).
