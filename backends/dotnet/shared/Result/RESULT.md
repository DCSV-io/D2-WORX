# Result

Standardized result types for operation outcomes with HTTP-aware status codes and structured error handling. Implements the Result pattern to eliminate exception-based control flow.

## Files

| File Name                                  | Description                                                                                                                    |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| [D2Result.cs](D2Result.cs)                 | Non-generic result type with success/failure status, messages, validation errors, and HTTP status codes.                       |
| [D2Result.Generic.cs](D2Result.Generic.cs) | Generic result type `D2Result<TData>` that includes typed data payload along with outcome metadata.                            |
| [ErrorCodes.cs](ErrorCodes.cs)             | Standard error code constants (NOT_FOUND, SOME_FOUND, FORBIDDEN, UNAUTHORIZED, VALIDATION_FAILED, CONFLICT, UNHANDLED_EXCEPTION). |
