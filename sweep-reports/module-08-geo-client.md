### Module 8: Geo Client

**Files reviewed**: 45 source files + 12 test files

Source files (total ~1,700 lines):
- `geo-client/src/index.ts` (83 lines)
- `geo-client/src/geo-client-options.ts` (24 lines)
- `geo-client/src/service-keys.ts` (39 lines)
- `geo-client/src/grpc/api-key-interceptor.ts` (15 lines)
- `geo-client/src/grpc/create-geo-client.ts` (17 lines)
- `geo-client/src/validation/contact-schemas.ts` (76 lines)
- 7 interface barrel/index files
- 12 interface definition files (c/, q/, x/, sub/)
- 14 CQRS handler files (c/, q/, x/)
- 2 messaging handler files (sub/)
- 2 messaging consumer files

Test files (total ~2,555 lines):
- `ref-data-handlers.test.ts` (266), `find-whois.test.ts` (294), `get.test.ts` (160)
- `create-contacts.test.ts` (258), `delete-contacts-by-ext-keys.test.ts` (304)
- `get-contacts-by-ext-keys.test.ts` (407), `get-contacts-by-ids.test.ts` (200)
- `updated.test.ts` (140), `updated-consumer.test.ts` (172)
- `update-contacts-by-ext-keys.test.ts` (432), `contacts-evicted.test.ts` (122)

---

**Assumptions documented**:

1. **Geo gRPC service availability**: Contact handlers assume Geo service is reachable. FindWhoIs and contact queries are fail-open.
2. **SHA-256 hash IDs are collision-free**: No collision handling exists.
3. **Single Node.js process per MemoryCacheStore**: LRU cache is not thread-safe.
4. **Contacts are immutable**: Cached without TTL based on documented immutability guarantee.
5. **WhoIs TTL is sufficient**: 8-hour TTL assumes IP geolocation doesn't change faster.
6. **API key never rotated mid-flight**: Captured at creation time. Rotation requires new client.
7. **gRPC callbacks always invoke**: Promise-wrapped gRPC calls assume callback always fires.
8. **No negative caching for ext-key misses**: Missing keys always hit gRPC.
9. **ContactsEvictedEvent data is accurate**: Eviction handler trusts event data.
10. **Disk persistence path is writable**: Error handling exists but failure = 500 result.

---

**Findings**:

| #  | Severity | Category        | File:Line | Description |
|----|----------|-----------------|-----------|-------------|
| 1  | Medium   | Bug             | `handlers/c/delete-contacts-by-ext-keys.ts:63-65` | **Cache eviction happens unconditionally after gRPC, even on failure.** If `handleGrpcCall` returns failure (e.g., ServiceUnavailable), cache is still evicted AND failure returned. Server may not have deleted contacts (network failure), yet local cache is cleared, causing unnecessary gRPC calls. Same in `update-contacts-by-ext-keys.ts:67-70`. Deliberate design choice (consistency > availability for mutations) but could surprise maintainers. |
| 2  | Medium   | Bug             | `handlers/q/get-contacts-by-ext-keys.ts:94-103` | **No negative caching for ext-key misses.** If key has no contacts in Geo, nothing cached. Every subsequent call hits gRPC. Creates "cache miss storm" for keys that genuinely have no contacts (e.g., deleted org). |
| 3  | Medium   | Security        | `grpc/api-key-interceptor.ts:11` | **API key transmitted in cleartext metadata.** Combined with `grpc.credentials.createInsecure()` as default in `create-geo-client.ts:14`, key sent in plaintext. Acceptable for local/dev but security issue in production without TLS. |
| 4  | Low      | Security        | `handlers/x/find-whois.ts:52` | **WhoIs cache key includes raw IP address.** `whois:${input.ipAddress}:${input.fingerprint}` — PII as Map keys. Minor since WhoIsDTO value also contains IP and cache is in-process only. `FIND_WHOIS_REDACTION` correctly masks in logs. |
| 5  | Low      | Consistency     | `handlers/c/set-in-mem.ts:26-28` | **SetInMem stores GeoRefData without TTL.** Never expires, only LRU-evicted. By design (updates are event-driven), but differs from FindWhoIs which uses explicit TTL. |
| 6  | Low      | Consistency     | `handlers/q/get-contacts-by-ids.ts:73-79` | **Different response structures for GetByIds vs GetByExtKeys.** Ids uses `Object.entries(response.data)`, ExtKeys uses array of `{ key, contacts }`. Reflects different proto shapes — correct but asymmetric. |
| 7  | Low      | Performance     | `handlers/x/get.ts:37-45` | **Get orchestrator retries ALL failures including permanent ones.** `isTransientResult: (r) => !r.success` retries even NOT_FOUND. Intentional (data may not be in any tier yet) but atypical. |
| 8  | Low      | Maintainability | `handlers/q/get-contacts-by-ext-keys.ts:96-103` | **Cache population only on `success: true`.** Partial results (SOME_FOUND) completely discarded. Correct but documented as intentional. |
| 9  | Low      | Consistency     | Test files | **Test creates incomplete `GeoClientOptions` object.** Missing required fields. Works at runtime because only `dataDir` is used. |
| 10 | Low      | Maintainability | Multiple handler files | **Repeated gRPC Promise wrapper pattern.** Same `new Promise<T>((resolve, reject) => { ... })` in 7 handlers. A shared `promisifyGrpcCall` utility would reduce duplication. |
| 11 | Low      | Maintainability | `handlers/x/get.ts:89-101` | **`setInMemoryAndOnDisk` runs sequentially.** Could be parallel via `Promise.all`. Same in `Updated` handler. Sequential is simpler, correctness unaffected. |
| 12 | Low      | Elegance        | `handlers/c/create-contacts.ts:31-39` | **Zod schema built with `.passthrough() as unknown as z.ZodType<Input>`.** Double cast in all 4 handlers with `allowedContextKeys`. Shared schema factory would encapsulate. |
| 13 | Low      | Elegance        | `handlers/q/get-from-mem.ts:31` | **Nested `data.data` wrapping.** `D2Result.ok({ data: { data: value } })` — naming collision between D2Result's `data` and output's `data` field. Consequence of interface design. |
| 14 | Low      | Test Gap        | `handlers/q/get-contacts-by-ids.ts` | **No input validation for `ids` array.** No max length, no format validation. Unbounded array could cause large gRPC request. |
| 15 | Low      | Consistency     | `handlers/x/find-whois.ts:48` | **Uses `validation.failed` while all other handlers use `!validation.success`.** Same condition checked differently. |
| 16 | Medium   | Bug             | `messaging/handlers/sub/updated.ts:50` | **Non-null assertion `distR.data!.data` after `distR.failed` check.** Safe because early return on failure, but `D2Result` allows `data` to be `undefined` even on success. Safer: `distR.checkSuccess()?.data` with null check. |
| 17 | Low      | Consistency     | `messaging/consumers/*.ts` | **Consumer logging uses string interpolation rather than structured logging fields.** Should use `{ version: message.version }` as second parameter. |
| 18 | Low      | Performance     | `handlers/x/find-whois.ts:63-65` | **Always sends single-element batch to gRPC.** Proto supports batch but handler always sends one. Consistent with .NET and current usage. |
| 19 | Low      | Consistency     | `GEO_CLIENT.md` | **Documentation missing `ContactsEvicted` handler and consumer in tables.** Added later but docs not updated. |
| 20 | Low      | Consistency     | `service-keys.ts` | **DI keys only for contact handlers and FindWhoIs.** Ref-data handlers wired manually via dependency objects. Deliberate but asymmetry should be documented. |

---

**Tests to add**:

- [ ] `GetContactsByExtKeys`: entry where `entry.key` is null/undefined in gRPC response
- [ ] `GetContactsByIds`: duplicate IDs in input array
- [ ] `FindWhoIs`: IPv6 addresses end-to-end through cache key construction
- [ ] `GetContactsByIds`: very large ID arrays (1000+)
- [ ] `ContactsEvicted`: ext-key/relatedEntityId containing colons (cache key ambiguity)
- [ ] `CreateContacts`: empty contacts array
- [ ] `SetOnDisk`: concurrent writes to same file
- [ ] `contacts-evicted-consumer`: consumer wrapper test (only handler tested, not consumer)

**Tests to remove**:

- (none — all existing tests are valid)
