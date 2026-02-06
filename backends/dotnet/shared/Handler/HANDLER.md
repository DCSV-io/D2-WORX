# Handler

Handler infrastructure implementing CQRS pattern with automatic logging, tracing, and error handling. Base classes for commands/queries with D2Result integration and OpenTelemetry instrumentation.

## Files

| File Name                                            | Description                                                                                                                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IHandler.cs](IHandler.cs)                           | Generic handler interface defining async operation contracts with input/output types, cancellation tokens, and optional handler configuration.                                                            |
| [BaseHandler.cs](BaseHandler.cs)                     | Abstract base handler with built-in OpenTelemetry tracing, structured logging, execution timing, and exception handling wrapper around ExecuteAsync.                                                      |
| [IHandlerContext.cs](IHandlerContext.cs)             | Context interface bundling IRequestContext and ILogger to reduce constructor boilerplate across handlers.                                                                                                 |
| [HandlerContext.cs](HandlerContext.cs)               | Default implementation of IHandlerContext providing request context and logging access.                                                                                                                   |
| [IRequestContext.cs](IRequestContext.cs)             | Request-scoped identity context with trace IDs, user authentication state, agent/target organization details, and relationship helpers.                                                                   |
| [HandlerOptions.cs](HandlerOptions.cs)               | Configuration options for handler execution behavior (validation, logging, etc.).                                                                                                                         |
| [BHASW.cs](BHASW.cs)                                 | Internal static class providing ActivitySource for OpenTelemetry distributed tracing of handler operations. Acronym: Base Handler Activity Source Wrapper.                                                |
| [OrgType.cs](OrgType.cs)                             | Enum defining organization types: Admin (full system access), Support (customer support capabilities), Affiliate (partners/resellers), Customer (standard users), CustomerClient (external subsidiaries). |
| [UserToOrgRelationship.cs](UserToOrgRelationship.cs) | Enum defining user-organization relationship types: DirectMember (direct membership), AssociatedMember (affiliate/partner association), Emulation (impersonation/emulation access).                       |
