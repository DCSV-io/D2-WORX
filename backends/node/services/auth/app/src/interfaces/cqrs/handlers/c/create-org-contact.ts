import type { IHandler, RedactionSpec } from "@d2/handler";
import type { OrgContact } from "@d2/auth-domain";
import type { ContactDTO } from "@d2/protos";

/** Contact details input shape (mirrors proto ContactToCreateDTO with optional nested fields). */
export interface ContactInput {
  readonly contactMethods?: {
    readonly emails?: { readonly value: string; readonly labels?: string[] }[];
    readonly phoneNumbers?: { readonly value: string; readonly labels?: string[] }[];
  };
  readonly personalDetails?: {
    readonly title?: string;
    readonly firstName?: string;
    readonly preferredName?: string;
    readonly middleName?: string;
    readonly lastName?: string;
    readonly generationalSuffix?: string;
    readonly professionalCredentials?: string[];
    readonly dateOfBirth?: string;
    readonly biologicalSex?: string;
  };
  readonly professionalDetails?: {
    readonly companyName?: string;
    readonly jobTitle?: string;
    readonly department?: string;
    readonly companyWebsite?: string;
  };
  readonly location?: {
    readonly coordinates?: { latitude: number; longitude: number };
    readonly address?: { line1?: string; line2?: string; line3?: string };
    readonly city?: string;
    readonly postalCode?: string;
    readonly subdivisionIso31662Code?: string;
    readonly countryIso31661Alpha2Code?: string;
  };
}

export interface CreateOrgContactInput {
  readonly organizationId: string;
  readonly label: string;
  readonly isPrimary?: boolean;
  /** IETF BCP 47 locale tag for the contact (e.g., "en-US"). Defaults to base locale if omitted. */
  readonly ietfBcp47Tag?: string;
  readonly contact: ContactInput;
}

export type CreateOrgContactOutput = { contact: OrgContact; geoContact: ContactDTO };

/** Recommended redaction for CreateOrgContact handlers. */
export const CREATE_ORG_CONTACT_REDACTION: RedactionSpec = {
  suppressInput: true,
  suppressOutput: true,
};

/** Handler for creating org contacts. Requires redaction (I/O contains PII). */
export interface ICreateOrgContactHandler extends IHandler<
  CreateOrgContactInput,
  CreateOrgContactOutput
> {
  readonly redaction: RedactionSpec;
}
