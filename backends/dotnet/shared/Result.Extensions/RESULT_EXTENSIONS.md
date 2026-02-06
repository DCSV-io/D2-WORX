# Result.Extensions

Extension methods for converting between D2Result and Protocol Buffer representations, plus gRPC call handling utilities. Bridges the gap between internal result types and wire-format messages.

## Files

| File Name                                | Description                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [ProtoExtensions.cs](ProtoExtensions.cs) | Extension methods for D2Result to/from D2ResultProto conversion and AsyncUnaryCall handling with automatic error translation. |

## Extension Methods

### D2Result → D2ResultProto

Converts internal result to wire format:

```csharp
var proto = result.ToProto();
```

### D2ResultProto → D2Result

Converts wire format back to internal result with typed data:

```csharp
var result = proto.ToD2Result(data);
```

### AsyncUnaryCall Handling

Wraps gRPC calls with automatic error handling and result conversion:

```csharp
var result = await client.SomeMethodAsync(request, ct)
    .HandleAsync(
        r => r.Result,    // Result selector
        r => r.Data,      // Data selector
        logger,           // Optional logger
        traceId);         // Optional trace ID
```

Automatically handles:

- `RpcException` → `D2Result.Fail` with `SERVICE_UNAVAILABLE`
- General exceptions → `D2Result.UnhandledException`
- Successful responses → `D2Result` with data from proto

## Usage Pattern

Typical handler implementation calling a gRPC service:

```csharp
protected override async ValueTask<D2Result<O?>> ExecuteAsync(
    I input,
    CancellationToken ct = default)
{
    var r = await r_client.SomeMethodAsync(new(), cancellationToken: ct)
        .HandleAsync(
            r => r.Result,
            r => r.Data,
            Context.Logger,
            TraceId);

    return D2Result<O?>.Bubble(r, new O(r.Data?.SomeField));
}
```
