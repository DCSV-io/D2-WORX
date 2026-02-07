# @d2/result-extensions

D2Result to/from Proto conversions and gRPC call wrapper. Mirrors `D2.Shared.Result.Extensions` in .NET. Layer 2.

## Files

| File Name                                                | Description                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [d2-result-to-proto.ts](src/d2-result-to-proto.ts)       | `d2ResultToProto()` — converts `D2Result` to `D2ResultProto` for gRPC responses.          |
| [d2-result-from-proto.ts](src/d2-result-from-proto.ts)   | `d2ResultFromProto()` — converts `D2ResultProto` to `D2Result` for gRPC client responses. |
| [handle-grpc-call.ts](src/handle-grpc-call.ts)           | `handleGrpcCall()` — wraps gRPC client calls with D2Result error handling.                |
| [index.ts](src/index.ts)                                 | Barrel re-export of all conversion functions.                                             |

## Usage

```typescript
import { d2ResultToProto, d2ResultFromProto, handleGrpcCall } from "@d2/result-extensions";

// Convert D2Result to Proto for gRPC response
const proto = d2ResultToProto(result);

// Convert Proto to D2Result from gRPC response
const result = d2ResultFromProto(proto);

// Wrap a gRPC client call with automatic error detection
const result = await handleGrpcCall(() => geoClient.findWhoIs(request));
```

## `handleGrpcCall`

Wraps a gRPC client call, catching `ServiceError` from `@grpc/grpc-js` and converting it to a `D2Result` failure. Non-gRPC errors become `UnhandledException` results.

## .NET Equivalent

`D2.Shared.Result.Extensions` — `ToProto()`, `FromProto()` extension methods + gRPC error handling.
