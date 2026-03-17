# @d2/files-domain

Pure domain types for the D2-WORX Files service. Zero infrastructure dependencies -- only depends on `@d2/utilities` for string cleaning and UUIDv7 generation.

## Purpose

Defines entities, enums, business rules, and constants for the **file upload and processing pipeline**. Files are uploaded, scanned (magic bytes + ClamAV), processed (resize/convert via sharp), and served via presigned URLs. These types are consumed by:

- `@d2/files-app` (CQRS handlers)
- `@d2/files-infra` (Drizzle repository, MinIO storage, ClamAV scanner)
- `@d2/files-api` (gRPC service, mappers)

## Design Decisions

| Decision                          | Rationale                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Readonly interfaces + factories   | More idiomatic TS than classes. Better tree-shaking, consistent functional style |
| Immutable-by-default              | "Mutation" returns new objects via spread+override                               |
| String literal unions (not enums) | `as const` arrays + derived types. No TS `enum` keyword                          |
| State machine on File             | `pending → processing → ready\|rejected` enforced via `transitionFileStatus`     |
| `sizeBytes` is `number`           | JS `number` handles up to 9 PB -- more than sufficient for file sizes            |
| Variants as JSONB array           | `FileVariant[]` stored on the File entity, populated when status = `ready`       |
| Context key prefix resolution     | `user_`/`org_` resolved from JWT, `thread_` via callback -- extensible           |
| Standard storage format           | Images converted to WebP for all variants; video/audio/document stored as-is     |
| No video transcoding              | Videos are store-and-serve only (original + thumbnail). Size limit is the guard  |
| MIME list includes smartphones    | HEIC/HEIF (iPhone photos), 3GPP (Android video), AAC/M4A (voice memos)           |

## Package Structure

```
src/
  index.ts                    Barrel exports
  constants/
    files-constants.ts        FILES_SIZE_LIMITS, FILES_FIELD_LIMITS, VARIANT_CONFIGS,
                              ALLOWED_CONTENT_TYPES, CONTEXT_KEY_PREFIXES, FILES_CONTEXT_KEYS,
                              FILES_MESSAGING, FILES_PROCESSING
    error-codes.ts            FILES_ERROR_CODES (9 codes, FILES_ prefixed)
  enums/
    file-status.ts            FileStatus: pending | processing | ready | rejected (+ state machine)
    content-category.ts       ContentCategory: image | document | video | audio
    rejection-reason.ts       RejectionReason: size_exceeded | invalid_content_type | magic_bytes_mismatch |
                              content_moderation_failed | processing_timeout | corrupt_file
    variant-size.ts           VariantSize: thumb | small | medium | large | original
  exceptions/
    files-domain-error.ts     Base error (extends Error)
    files-validation-error.ts Structured validation error (entityName, propertyName, invalidValue, reason)
  entities/
    file.ts                   File interface + createFile + transitionFileStatus
  value-objects/
    file-variant.ts           FileVariant interface + createFileVariant
    context-key-config.ts     ContextKeyConfig interface (type-only, no factory)
  rules/
    context-key-rules.ts      isValidContextKeyFormat, resolveContextKeyPrefix, requiresExternalAccessCheck
    content-type-rules.ts     resolveContentCategory, isContentTypeAllowed, getAllowedContentTypes
    variant-rules.ts          getRequiredVariants, getVariantDimensions, requiresResize
```

## Enums

All "enums" are `as const` arrays with derived union types and type guard functions.

| Enum            | Values                                                                                                                 | Extras                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| FileStatus      | pending, processing, ready, rejected                                                                                   | `FILE_STATUS_TRANSITIONS` state machine |
| ContentCategory | image, document, video, audio                                                                                          | `isValidContentCategory` guard          |
| RejectionReason | size_exceeded, invalid_content_type, magic_bytes_mismatch, content_moderation_failed, processing_timeout, corrupt_file | `isValidRejectionReason` guard          |
| VariantSize     | thumb, small, medium, large, original                                                                                  | `isValidVariantSize` guard              |

### File Status State Machine

```
pending → processing | rejected
processing → ready | rejected
ready → (terminal)
rejected → (terminal)
```

## Entities

| Entity | Factory      | Transition             | Key Rules                                                                                                                                                                         |
| ------ | ------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File   | `createFile` | `transitionFileStatus` | Starts as `pending`, variants=null until `ready`, rejectionReason=null until `rejected`. All string fields cleaned via `cleanStr()`, sizeBytes validated against configurable max |

## Value Objects

| Value Object     | Factory             | Notes                                                                              |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------- |
| FileVariant      | `createFileVariant` | Processed variant (size, MinIO key, dimensions, sizeBytes, contentType)            |
| ContextKeyConfig | -- (type-only)      | Per-context-key config (allowedCategories, maxSizeBytes). Used by app/infra layers |

## Business Rules

| Rule                  | Function                                 | Description                                                   |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| Context key format    | `isValidContextKeyFormat(key)`           | Regex: `^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)*$`, max length       |
| Context key prefix    | `resolveContextKeyPrefix(key)`           | Returns prefix config (resolution: jwt or callback) or null   |
| External access check | `requiresExternalAccessCheck(key)`       | True for `thread_` prefix (callback resolution)               |
| Content category      | `resolveContentCategory(contentType)`    | MIME → category mapping, null if unknown                      |
| Content type allowed  | `isContentTypeAllowed(type, categories)` | Checks MIME type belongs to one of the allowed categories     |
| All allowed types     | `getAllowedContentTypes(categories)`     | Flat array of all MIME types for given categories             |
| Required variants     | `getRequiredVariants(category)`          | image: all 5, video: thumb+original, document/audio: original |
| Variant dimensions    | `getVariantDimensions(size)`             | Lookup from VARIANT_CONFIGS (e.g., thumb=64x64)               |
| Resize needed         | `requiresResize(size)`                   | True unless width/height are 0 (original)                     |

## Constants

### FILES_SIZE_LIMITS

| Constant                    | Value | Purpose                 |
| --------------------------- | ----- | ----------------------- |
| `DEFAULT_MAX_SIZE_BYTES`    | 25 MB | Default upload limit    |
| `AVATAR_MAX_SIZE_BYTES`     | 5 MB  | Avatar-specific limit   |
| `DOCUMENT_MAX_SIZE_BYTES`   | 25 MB | Document-specific limit |
| `ATTACHMENT_MAX_SIZE_BYTES` | 10 MB | Thread attachment limit |

### FILES_FIELD_LIMITS

| Constant                       | Value | Purpose                    |
| ------------------------------ | ----- | -------------------------- |
| `MAX_CONTEXT_KEY_LENGTH`       | 100   | Max context key string     |
| `MAX_RELATED_ENTITY_ID_LENGTH` | 255   | Max related entity ID      |
| `MAX_CONTENT_TYPE_LENGTH`      | 255   | Max MIME type string       |
| `MAX_DISPLAY_NAME_LENGTH`      | 255   | Max user-provided filename |
| `MAX_VARIANT_KEY_LENGTH`       | 512   | Max MinIO storage key      |

### VARIANT_CONFIGS

| Size     | Width | Height | Purpose                 |
| -------- | ----- | ------ | ----------------------- |
| thumb    | 64    | 64     | Thumbnail               |
| small    | 128   | 128    | Small preview           |
| medium   | 512   | 512    | Medium display          |
| large    | 1024  | 1024   | Full-size display       |
| original | 0     | 0      | No resize (store as-is) |

### ALLOWED_CONTENT_TYPES

| Category | MIME Types                                                |
| -------- | --------------------------------------------------------- |
| image    | jpeg, png, gif, webp, svg+xml, avif, heic, heif           |
| document | pdf, docx (openxml), xlsx (openxml), text/plain, text/csv |
| video    | mp4, webm, quicktime, 3gpp                                |
| audio    | mpeg, ogg, wav, webm, aac, mp4                            |

### FILES_MESSAGING

| Constant               | Value              | Purpose                             |
| ---------------------- | ------------------ | ----------------------------------- |
| `EVENTS_EXCHANGE`      | `files.events`     | Topic exchange for lifecycle events |
| `EVENTS_EXCHANGE_TYPE` | `topic`            | Exchange type                       |
| `PROCESSING_QUEUE`     | `files.processing` | Worker queue for file processing    |

### FILES_ERROR_CODES

| Code                        | Value                             |
| --------------------------- | --------------------------------- |
| `FILE_TOO_LARGE`            | `FILES_FILE_TOO_LARGE`            |
| `INVALID_CONTENT_TYPE`      | `FILES_INVALID_CONTENT_TYPE`      |
| `CONTENT_TYPE_NOT_ALLOWED`  | `FILES_CONTENT_TYPE_NOT_ALLOWED`  |
| `PROCESSING_FAILED`         | `FILES_PROCESSING_FAILED`         |
| `INVALID_CONTEXT_KEY`       | `FILES_INVALID_CONTEXT_KEY`       |
| `ACCESS_DENIED`             | `FILES_ACCESS_DENIED`             |
| `VARIANT_NOT_FOUND`         | `FILES_VARIANT_NOT_FOUND`         |
| `FILE_REJECTED`             | `FILES_FILE_REJECTED`             |
| `INVALID_STATUS_TRANSITION` | `FILES_INVALID_STATUS_TRANSITION` |

## Tests

All tests are in `@d2/files-tests` (`backends/node/services/files/tests/`):

```
src/unit/domain/
  constants/    files-constants.test.ts, error-codes.test.ts
  enums/        file-status.test.ts, content-category.test.ts,
                rejection-reason.test.ts, variant-size.test.ts
  exceptions/   files-domain-error.test.ts, files-validation-error.test.ts
  entities/     file.test.ts
  value-objects/ file-variant.test.ts
  rules/        context-key-rules.test.ts, content-type-rules.test.ts, variant-rules.test.ts
```

Run: `pnpm vitest run --project files-tests`

## Dependencies

| Package         | Purpose                 |
| --------------- | ----------------------- |
| `@d2/utilities` | String cleaning, UUIDv7 |
