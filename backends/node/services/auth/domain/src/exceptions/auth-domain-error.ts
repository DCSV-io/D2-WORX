/**
 * Base error type for the Auth domain.
 */
export class AuthDomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthDomainError";
  }
}
