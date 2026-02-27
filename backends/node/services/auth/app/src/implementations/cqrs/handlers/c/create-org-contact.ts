import { z } from "zod";
import { BaseHandler, type IHandlerContext, type RedactionSpec, zodGuid, zodNonEmptyString } from "@d2/handler";
import { D2Result } from "@d2/result";
import { generateUuidV7 } from "@d2/utilities";
import { createOrgContact, GEO_CONTEXT_KEYS, type OrgContact } from "@d2/auth-domain";
import type { ContactDTO, ContactToCreateDTO } from "@d2/protos";
import { contactInputSchema, type Commands } from "@d2/geo-client";
import type {
  ICreateOrgContactRecordHandler,
  IDeleteOrgContactRecordHandler,
} from "../../../../interfaces/repository/handlers/index.js";

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
  readonly contact: ContactInput;
}

export type CreateOrgContactOutput = { contact: OrgContact; geoContact: ContactDTO };

const schema = z.object({
  organizationId: zodGuid,
  label: zodNonEmptyString(100),
  isPrimary: z.boolean().optional(),
  contact: contactInputSchema,
});

/**
 * Creates an org contact: first creates the junction record, then creates
 * the Geo contact via gRPC using the junction ID as relatedEntityId.
 *
 * The caller provides full contact details (not a contactId). This handler
 * pre-generates the org_contact ID, creates the junction, then creates the
 * Geo contact with contextKey="auth_org_contact" and relatedEntityId=orgContact.id.
 * If Geo creation fails, the junction is rolled back (deleted).
 */
export class CreateOrgContact extends BaseHandler<CreateOrgContactInput, CreateOrgContactOutput> {
  private readonly createRecord: ICreateOrgContactRecordHandler;
  private readonly deleteRecord: IDeleteOrgContactRecordHandler;
  private readonly createContacts: Commands.ICreateContactsHandler;

  get redaction(): RedactionSpec {
    return { suppressInput: true, suppressOutput: true };
  }

  constructor(
    createRecord: ICreateOrgContactRecordHandler,
    deleteRecord: IDeleteOrgContactRecordHandler,
    context: IHandlerContext,
    createContacts: Commands.ICreateContactsHandler,
  ) {
    super(context);
    this.createRecord = createRecord;
    this.deleteRecord = deleteRecord;
    this.createContacts = createContacts;
  }

  protected async executeAsync(
    input: CreateOrgContactInput,
  ): Promise<D2Result<CreateOrgContactOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // Pre-generate org_contact ID — this becomes the relatedEntityId for Geo
    const orgContactId = generateUuidV7();

    // Create junction record first (no contactId column)
    const contact = createOrgContact({
      id: orgContactId,
      organizationId: input.organizationId,
      label: input.label,
      isPrimary: input.isPrimary,
    });

    const createResult = await this.createRecord.handleAsync({ contact });
    if (!createResult.success) return D2Result.bubbleFail(createResult);

    // Build ContactToCreateDTO using junction ID as relatedEntityId
    const contactToCreate = {
      createdAt: new Date(),
      contextKey: GEO_CONTEXT_KEYS.ORG_CONTACT,
      relatedEntityId: orgContactId,
      contactMethods: input.contact.contactMethods ?? undefined,
      personalDetails: input.contact.personalDetails ?? undefined,
      professionalDetails: input.contact.professionalDetails ?? undefined,
      location: input.contact.location ?? undefined,
    } as ContactToCreateDTO;

    const geoResult = await this.createContacts.handleAsync({ contacts: [contactToCreate] });
    if (!geoResult.success || !geoResult.data) {
      // Rollback: delete the junction since Geo contact creation failed
      try {
        await this.deleteRecord.handleAsync({ id: orgContactId });
      } catch {
        // Best-effort rollback — log elsewhere
      }
      return D2Result.bubbleFail(geoResult);
    }

    const geoContact = geoResult.data.data[0];
    if (!geoContact) {
      try {
        await this.deleteRecord.handleAsync({ id: orgContactId });
      } catch {
        // Best-effort rollback
      }
      return D2Result.bubbleFail(geoResult);
    }

    return D2Result.ok({ data: { contact, geoContact } });
  }
}
