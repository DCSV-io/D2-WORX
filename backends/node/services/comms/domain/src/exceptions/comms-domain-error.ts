/**
 * Base error type for the Comms domain.
 */
export class CommsDomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CommsDomainError";
  }
}
