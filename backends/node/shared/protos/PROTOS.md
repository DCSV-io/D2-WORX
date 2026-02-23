# @d2/protos

Generated TypeScript types and gRPC client stubs from Protocol Buffers. Layer 0 — no project dependencies.

## Generation

All TypeScript code is generated from `.proto` files in `contracts/protos/` using:

- **`@bufbuild/buf`** — Build and generate tool
- **`ts-proto`** — TypeScript code generator

Run `pnpm --filter @d2/protos generate` to regenerate.

## Key Exports

| Export                                    | Proto Source     | Description                             |
| ----------------------------------------- | ---------------- | --------------------------------------- |
| `D2ResultProto`                           | `common/v1/`     | Protobuf representation of D2Result     |
| `InputErrorProto`                         | `common/v1/`     | Protobuf representation of input errors |
| `PingServiceClient`                       | `common/v1/`     | Health check gRPC client                |
| `GeoServiceClient`                        | `geo/v1/`        | Geo service gRPC client                 |
| `FindWhoIsRequest/Response`               | `geo/v1/`        | WhoIs lookup messages                   |
| `GetReferenceDataResponse`                | `geo/v1/`        | Geo reference data response             |
| `ContactDTO`, `ContactToCreateDTO`        | `geo/v1/`        | Contact data transfer objects           |
| `CreateContactsRequest/Response`          | `geo/v1/`        | Batch contact creation                  |
| `GetContactsByExtKeysRequest/Response`    | `geo/v1/`        | Contact lookup by ext keys              |
| `DeleteContactsByExtKeysRequest/Response` | `geo/v1/`        | Delete contacts by ext keys             |
| `UpdateContactsByExtKeysRequest/Response` | `geo/v1/`        | Replace contacts at ext keys            |
| `CountryDTO`, `LocationDTO`, etc.         | `geo/v1/`        | Geo domain DTOs                         |
| `GeoRefDataUpdatedEvent`                  | `events/v1/`     | Geo reference data refresh event        |
| `SendVerificationEmailEvent`              | `events/v1/`     | Auth → Comms: email verification        |
| `SendPasswordResetEvent`                  | `events/v1/`     | Auth → Comms: password reset            |
| `SendInvitationEmailEvent`                | `events/v1/`     | Auth → Comms: invitation email          |
| `CommsServiceClient`                      | `comms/v1/`      | Comms service gRPC client               |
| `DeliverRequest/Response`                 | `comms/v1/`      | Delivery orchestration messages         |
| `Timestamp`                               | Well-known types | Google protobuf timestamp               |

## Dependencies

- `@bufbuild/protobuf` — Runtime protobuf support (BinaryReader/BinaryWriter)
- `@grpc/grpc-js` — gRPC client runtime

## Notes

- `verbatimModuleSyntax: false` in `tsconfig.json` — generated code doesn't comply with strict module syntax
- Proto source at `contracts/protos/` is the single source of truth — both .NET and Node.js read from there

## .NET Equivalent

`Protos.DotNet` — Generated C# protobuf types via `Grpc.Tools`.
