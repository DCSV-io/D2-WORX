### Module 7: Messaging + Service Defaults

**Files reviewed**: 22 files, 1808 lines total

_Messaging package (`@d2/messaging`)_:

- `messaging/src/index.ts` (15 lines)
- `messaging/src/types.ts` (94 lines)
- `messaging/src/message-bus.ts` (187 lines)
- `messaging/src/handlers/q/ping.ts` (34 lines)
- `messaging/src/service-keys.ts` (9 lines)
- `messaging/package.json` (26 lines)
- `messaging/MESSAGING.md` (43 lines)

_Service Defaults package (`@d2/service-defaults`)_:

- `service-defaults/src/index.ts` (6 lines)
- `service-defaults/src/setup-telemetry.ts` (96 lines)
- `service-defaults/src/telemetry-config.ts` (19 lines)
- `service-defaults/src/register.ts` (34 lines)
- `service-defaults/src/grpc/index.ts` (4 lines)
- `service-defaults/src/grpc/extract-trace-context.ts` (23 lines)
- `service-defaults/src/grpc/with-trace-context.ts` (16 lines)
- `service-defaults/src/grpc/with-api-key-auth.ts` (77 lines)
- `service-defaults/src/grpc/create-rpc-scope.ts` (58 lines)
- `service-defaults/package.json` (42 lines)
- `service-defaults/SERVICE_DEFAULTS.md` (36 lines)

_Test files_:

- `tests/src/unit/messaging/message-bus.test.ts` (579 lines)
- `tests/src/integration/messaging/message-bus.integration.test.ts` (332 lines)
- `tests/src/integration/messaging/rabbitmq-test-helpers.ts` (41 lines)
- `comms/tests/src/unit/api/api-key-interceptor.test.ts` (184 lines)

---

**Assumptions documented**:

1. `rabbitmq-client` handles auto-reconnect internally; `MessageBus` does not implement reconnection logic — trusts the library entirely.
2. OTel collector endpoints configured via env vars (`OTEL_EXPORTER_OTLP_*`) set by Aspire's `WithOtelRefs()` or via `TelemetryConfig`. When neither is set, exporters simply not created (silent no-op).
3. `OTEL_SERVICE_NAME` env var always set by Aspire in production. Falls back to `"unknown-service"` in `register.ts`.
4. All gRPC RPCs are unary. `withApiKeyAuth` explicitly documents this and will silently fail on streaming RPCs.
5. Messages are always JSON-serializable. No binary/protobuf serialization at transport layer.
6. `declareTopology()` is idempotent (standard AMQP 0-9-1 behavior).
7. `consumer.on("error", () => {})` no-op listener assumes handler errors are expected (ACK/NACK semantics).
8. `createRpcScope` uses `crypto.randomUUID()` as fallback (Node.js 19+).

---

**Findings**:

| #   | Severity | Category        | File:Line                         | Description                                                                                                                                                                                                                                                                                                                                           |
| --- | -------- | --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | Bug             | `message-bus.ts:55`               | **Silent error swallowing on consumers.** `consumer.on("error", () => {})` suppresses ALL consumer errors — not just handler throws but also channel-level AMQP errors (PRECONDITION_FAILED, channel closure). If channel dies, error is silently eaten with zero logging. Same issue at lines 55 and 101 (both `subscribe` and `subscribeEnriched`). |
| 2   | Medium   | Bug             | `message-bus.ts:58,104`           | **`ready` promise may never resolve if consumer setup fails.** Resolves on `"ready"` event, but if consumer fails during setup (queue declaration conflict), `"ready"` never fires. The `"error"` event is swallowed (finding #1). Callers awaiting `consumer.ready` hang indefinitely. No timeout or error path.                                     |
| 3   | Medium   | Performance     | `setup-telemetry.ts:69`           | **`getNodeAutoInstrumentations()` with no exclusions.** All auto-instrumentations loaded, including MySQL, MongoDB, Express, etc. Adds startup overhead and possible peer dependency warnings. .NET equivalent uses curated list. Consider disabling unused instrumentations.                                                                         |
| 4   | Medium   | Bug             | `setup-telemetry.ts:80`           | **`serviceName` set twice — resource attribute AND top-level config.** `NodeSDK` constructor creates its own resource from `serviceName` and merges with provided `resource`. Could result in duplicate service name or override. Remove top-level `serviceName` and rely solely on resource attribute.                                               |
| 5   | Medium   | Test Gap        | N/A                               | **No tests for `PingMessageBus` handler.** 34-line handler with zero test coverage.                                                                                                                                                                                                                                                                   |
| 6   | High     | Test Gap        | N/A                               | **No tests for ANY `@d2/service-defaults` source code.** `setup-telemetry.ts`, `register.ts`, `telemetry-config.ts`, `extract-trace-context.ts`, `with-trace-context.ts`, and `create-rpc-scope.ts` all have ZERO test coverage. Only `with-api-key-auth.ts` tested (via comms-tests). Foundational OTel bootstrap for all Node.js services.          |
| 7   | Low      | Security        | `with-api-key-auth.ts:62`         | **Timing-safe comparison not used for API key validation.** `validKeys.has(apiKey)` uses standard Set.has(). Practical risk negligible (gRPC latency, hash-based comparison, non-guessable keys).                                                                                                                                                     |
| 8   | Low      | Performance     | `setup-telemetry.ts:53`           | **No export interval configured for PeriodicExportingMetricReader.** Uses default 60-second interval. Development could see 60s delay before metrics appear.                                                                                                                                                                                          |
| 9   | Low      | Maintainability | `setup-telemetry.ts:86-95`        | **Signal handlers do not exit the process.** SIGTERM calls `sdk.shutdown()` but never `process.exit()`. Process relies on event loop draining. May hang with active connections.                                                                                                                                                                      |
| 10  | Low      | Maintainability | `setup-telemetry.ts:86-95`        | **Signal handlers registered without deduplication guard.** Multiple `setupTelemetry()` calls accumulate handlers. Theoretical with current usage.                                                                                                                                                                                                    |
| 11  | Low      | Consistency     | `SERVICE_DEFAULTS.md:32`          | **Documentation lists re-exported `Counter` and `Histogram` types, but these are NOT actually re-exported.** Index only exports `Tracer`, `Meter`, `Span`.                                                                                                                                                                                            |
| 12  | Low      | Consistency     | `SERVICE_DEFAULTS.md:18-23`       | **Documentation example shows `otlpEndpoint` property, but config uses per-signal endpoints** (`tracesEndpoint`, `metricsEndpoint`, `logsEndpoint`).                                                                                                                                                                                                  |
| 13  | Low      | Consistency     | `MESSAGING.md:20-31`              | **Documentation example shows APIs that don't exist.** Actual API uses `subscribe(config, handler)` and `publisher.send(target, message)`, not the patterns shown.                                                                                                                                                                                    |
| 14  | Low      | Maintainability | `package.json (service-defaults)` | **Unused dependency: `@opentelemetry/sdk-trace-node` (v2.5.0).** Listed but never imported. `NodeSDK` from `@opentelemetry/sdk-node` bundles trace provider internally.                                                                                                                                                                               |
| 15  | Low      | Elegance        | `message-bus.ts:96`               | **Double cast `as unknown as ConsumerStatus`.** `ConsumerResult` enum manually matches `ConsumerStatus` values. Fragile if `rabbitmq-client` changes enum values. Runtime assertion or mapping would be safer.                                                                                                                                        |
| 16  | Low      | Test Gap        | N/A                               | **`withApiKeyAuth` exempt methods not tested.** The `exempt` option is used by comms-api for `checkHealth` but no tests exercise this code path.                                                                                                                                                                                                      |
| 17  | Low      | Consistency     | `create-rpc-scope.ts:55`          | **Logger resolved from root provider, not from scope.** Functionally correct (logger is singleton) but differs from pattern in comms composition root.                                                                                                                                                                                                |
| 18  | Low      | Maintainability | `message-bus.ts:24-28`            | **No connection event listeners.** `MessageBus` creates `Connection` but attaches no listeners for `"error"`, `"connection"`, `"close"`. Connection-level errors may go unnoticed. Library handles reconnection but operational visibility is lost.                                                                                                   |
| 19  | Low      | Consistency     | `message-bus.ts:168`              | **`ping()` default timeout (5s) differs from `waitForConnection()` default timeout (10s).** May be intentional but could be surprising.                                                                                                                                                                                                               |

---

**Tests to add**:

- [ ] Unit tests for `PingMessageBus` handler — happy path, unhealthy, error
- [ ] Unit tests for `extractGrpcTraceContext` — valid traceparent, missing metadata, non-string values
- [ ] Unit tests for `withTraceContext` — handler runs within extracted context
- [ ] Unit tests for `createRpcScope` — default IRequestContext, custom factory, traceId extraction, UUID fallback
- [ ] Unit tests for `withApiKeyAuth` exempt option
- [ ] Unit tests for `setupTelemetry` — doesn't throw with minimal config, signal handlers registered
- [ ] Integration test for `MessageBus.ping()` against real RabbitMQ

**Tests to remove**:

- (none — all existing tests are valid)

---

**Additional observations**:

1. The gRPC utilities in `service-defaults/grpc` have grown beyond pure OTel defaults. `withApiKeyAuth` and `createRpcScope` are gRPC server infrastructure utilities depending on `@d2/di`, `@d2/handler`, `@d2/logging`. Package name `service-defaults` no longer fully describes its scope.
2. Dead-letter handling is well-architected. DLX retry topology + `subscribeEnriched`'s `requeue: false` gives full control. Max attempts (10) result in message drop with error logging.
3. The `register.ts` ESM loader hook pattern is correct and critical for Pino log bridging and gRPC context propagation in ESM environments.
