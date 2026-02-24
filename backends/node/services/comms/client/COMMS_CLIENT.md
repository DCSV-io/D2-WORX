# @d2/comms-client

Thin client library for publishing notification requests to the Comms service via RabbitMQ. Consuming services call a single `Notify` handler with a universal message shape; the Comms service resolves the recipient's address, picks channels, renders markdown, and delivers.

Mirrors the `@d2/geo-client` pattern: a service-owned client that lives alongside the service it fronts, registered into any consumer's DI container.

## File Tree

```
client/
├── package.json
├── tsconfig.json
├── COMMS_CLIENT.md
└── src/
    ├── index.ts                     # Public API re-exports
    ├── comms-client-constants.ts    # RabbitMQ exchange names
    ├── registration.ts              # DI registration (addCommsClient)
    ├── service-keys.ts              # DI ServiceKeys (INotifyKey)
    └── handlers/
        └── pub/
            └── notify.ts            # Notify handler (Pub = publish)
```

---

## Universal Message Shape

Every notification published through the client uses a single `NotifyInput` shape. The Comms service decides which channels to use based on the recipient's contact data, the `sensitive` flag, and `urgency`.

| Field                  | Type                       | Required | Description                                                   |
| ---------------------- | -------------------------- | -------- | ------------------------------------------------------------- |
| `recipientContactId`   | `string` (UUID)            | Yes      | Geo contact ID -- the ONLY recipient identifier               |
| `title`                | `string` (max 255)         | Yes      | Email subject, SMS prefix, push title                         |
| `content`              | `string` (max 50,000)      | Yes      | Markdown body -- rendered to HTML for email                   |
| `plaintext`            | `string` (max 50,000)      | Yes      | Plain text -- SMS body, email fallback                        |
| `sensitive`            | `boolean`                  | No       | Default `false`. When `true`, email only (secure channel)     |
| `urgency`              | `"normal"` \| `"urgent"`   | No       | Default `"normal"`. `"urgent"` bypasses prefs, all channels   |
| `correlationId`        | `string` (max 36)          | Yes      | Idempotency key for deduplication                             |
| `senderService`        | `string` (max 50)          | Yes      | Source service identifier (e.g. `"auth"`, `"billing"`)        |
| `metadata`             | `Record<string, unknown>`  | No       | Arbitrary key-value pairs for future use                      |

All fields are validated via Zod before publishing.

---

## Registration

Register into any service's DI container during composition:

```ts
import { addCommsClient } from "@d2/comms-client";

addCommsClient(services, { publisher: messageBus.publisher });
```

`addCommsClient` accepts an `AddCommsClientOptions` with a single optional field:

| Option      | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `publisher` | `IMessagePublisher \| undefined`  | RabbitMQ publisher. Omit for local dev / tests -- handler logs and returns success |

The handler is registered as **transient** under `INotifyKey`.

---

## Usage

Resolve `INotifyKey` from the DI scope and call `handleAsync`:

```ts
import { INotifyKey } from "@d2/comms-client";

const notify = scope.resolve(INotifyKey);

const result = await notify.handleAsync({
  recipientContactId: "01926a3b-...",
  title: "Verify your email",
  content: "Click [here](https://...) to verify.",
  plaintext: "Visit https://... to verify your email.",
  correlationId: crypto.randomUUID(),
  senderService: "auth",
});
```

### Auth Service Example (typical caller)

Auth resolves the user's Geo contact ID before notifying:

```ts
// 1. Resolve contact via geo-client (ext-key lookup)
const contacts = await getContactsByExtKeys.handleAsync({
  contextKey: "auth_user",
  relatedEntityId: userId,
});

// 2. Publish notification
const notify = scope.resolve(INotifyKey);
await notify.handleAsync({
  recipientContactId: contacts.data![0].id,
  title: "Password reset",
  content: "Use this [link](https://...) to reset your password.",
  plaintext: "Visit https://... to reset your password.",
  correlationId: crypto.randomUUID(),
  senderService: "auth",
  sensitive: true,
});
```

---

## Key Design Decisions

| Decision                           | Rationale                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Contacts only, never userIds**   | Decouples identity from delivery. Comms resolves addresses from Geo contacts, never queries Auth           |
| **`sensitive` gates channel**      | `true` restricts to email only (encrypted transport). SMS/push excluded for PII-heavy content              |
| **`urgency` bypasses preferences** | `"urgent"` forces delivery on all available channels regardless of user notification preferences           |
| **Fire-and-forget via RabbitMQ**   | Publisher returns success once the message is enqueued. Comms handles retries, rendering, and delivery     |
| **No-op without publisher**        | When `publisher` is omitted, handler logs the notification and returns `Ok` -- safe for tests and local dev |
| **Single exchange, no routing**    | All notifications go to `comms.notifications` fanout exchange with empty routing key                       |

---

## Messaging Topology

| Constant                 | Value                  | Type            | Used By                          |
| ------------------------ | ---------------------- | --------------- | -------------------------------- |
| `NOTIFICATIONS_EXCHANGE` | `comms.notifications`  | Fanout exchange | comms-client (pub), comms-infra (sub) |

Shared via `COMMS_EVENTS` constant object, imported by both the client publisher and the Comms service consumer to keep exchange naming in sync.

---

## Dependencies

| Package         | Purpose                                |
| --------------- | -------------------------------------- |
| `@d2/di`        | ServiceKey + ServiceCollection for DI  |
| `@d2/handler`   | BaseHandler + IHandlerContext          |
| `@d2/messaging` | IMessagePublisher for RabbitMQ publish |
| `@d2/result`    | D2Result return type                   |
| `zod`           | Input validation schema                |

---

## .NET Equivalent

No .NET `Comms.Client` exists yet. When built, it would follow the same pattern as `Geo.Client`: a class library with handler interfaces, DI extensions, and RabbitMQ publishing -- consumed by the .NET Gateway or any .NET service needing to send notifications.
