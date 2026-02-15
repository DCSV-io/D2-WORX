import { AuthDomainError } from "./auth-domain-error.js";

/**
 * Structured validation error for the Auth domain.
 * Mirrors GeoValidationException in .NET.
 */
export class AuthValidationError extends AuthDomainError {
  readonly entityName: string;
  readonly propertyName: string;
  readonly invalidValue: unknown;
  readonly reason: string;

  constructor(entityName: string, propertyName: string, invalidValue: unknown, reason: string) {
    super(
      `Validation failed for ${entityName}.${propertyName} with value '${invalidValue}': ${reason}`,
    );
    this.name = "AuthValidationError";
    this.entityName = entityName;
    this.propertyName = propertyName;
    this.invalidValue = invalidValue;
    this.reason = reason;
  }
}
