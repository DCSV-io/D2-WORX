import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import { updateOrgContact, type OrgContact, type UpdateOrgContactInput } from "@d2/auth-domain";
import type { ContactDTO, ContactToCreateDTO } from "@d2/protos";
import type { Complex } from "@d2/geo-client";
import type { IOrgContactRepository } from "../../../../interfaces/repository/org-contact-repository.js";
import type { ContactInput } from "./create-org-contact.js";

export interface UpdateOrgContactHandlerInput {
  readonly id: string;
  readonly organizationId: string;
  readonly updates: UpdateOrgContactInput & {
    /** If provided, triggers contact replacement via UpdateContactsByExtKeys. */
    readonly contact?: ContactInput;
  };
}

export type UpdateOrgContactOutput = {
  contact: OrgContact;
  geoContact?: ContactDTO;
};

const contactSchema = z
  .object({
    contactMethods: z
      .object({
        emails: z
          .array(z.object({ value: z.string().email(), labels: z.array(z.string()).optional() }))
          .optional(),
        phoneNumbers: z
          .array(z.object({ value: z.string().min(1), labels: z.array(z.string()).optional() }))
          .optional(),
      })
      .optional(),
    personalDetails: z
      .object({
        title: z.string().optional(),
        firstName: z.string().optional(),
        preferredName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        generationalSuffix: z.string().optional(),
        professionalCredentials: z.array(z.string()).optional(),
        dateOfBirth: z.string().optional(),
        biologicalSex: z.string().optional(),
      })
      .optional(),
    professionalDetails: z
      .object({
        companyName: z.string().optional(),
        jobTitle: z.string().optional(),
        department: z.string().optional(),
        companyWebsite: z.string().optional(),
      })
      .optional(),
    location: z
      .object({
        coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
        address: z
          .object({
            line1: z.string().optional(),
            line2: z.string().optional(),
            line3: z.string().optional(),
          })
          .optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        subdivisionIso31662Code: z.string().optional(),
        countryIso31661Alpha2Code: z.string().optional(),
      })
      .optional(),
  })
  .optional();

const schema = z.object({
  id: zodGuid,
  organizationId: zodGuid,
  updates: z
    .object({
      label: z.string().max(100).optional(),
      isPrimary: z.boolean().optional(),
      contact: contactSchema,
    })
    .refine(
      (u) => u.label !== undefined || u.isPrimary !== undefined || u.contact !== undefined,
      "At least one field (label, isPrimary, or contact) must be provided.",
    ),
});

/**
 * Updates an existing org contact junction record.
 *
 * Two modes:
 * 1. **Metadata-only** (label and/or isPrimary) — updates junction fields in place.
 * 2. **Contact replacement** (contact details provided) — calls UpdateContactsByExtKeys
 *    which atomically replaces the Geo contact at the ext key. Then updates junction metadata.
 */
export class UpdateOrgContactHandler extends BaseHandler<
  UpdateOrgContactHandlerInput,
  UpdateOrgContactOutput
> {
  private readonly repo: IOrgContactRepository;
  private readonly updateContactsByExtKeys: Complex.IUpdateContactsByExtKeysHandler;

  constructor(
    repo: IOrgContactRepository,
    context: IHandlerContext,
    updateContactsByExtKeys: Complex.IUpdateContactsByExtKeysHandler,
  ) {
    super(context);
    this.repo = repo;
    this.updateContactsByExtKeys = updateContactsByExtKeys;
  }

  protected async executeAsync(
    input: UpdateOrgContactHandlerInput,
  ): Promise<D2Result<UpdateOrgContactOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const existing = await this.repo.findById(input.id);
    if (!existing) {
      return D2Result.notFound({ traceId: this.traceId });
    }

    // IDOR check: contact must belong to the caller's active org
    if (existing.organizationId !== input.organizationId) {
      return D2Result.fail({
        messages: ["Not authorized to modify this contact."],
        statusCode: HttpStatusCode.Forbidden,
        errorCode: ErrorCodes.FORBIDDEN,
        traceId: this.traceId,
      });
    }

    let newGeoContact: ContactDTO | undefined;

    // Contact replacement flow — single call to Geo
    if (input.updates.contact) {
      const contactToCreate = {
        createdAt: new Date(),
        contextKey: "org_contact",
        relatedEntityId: existing.id,
        contactMethods: input.updates.contact.contactMethods ?? undefined,
        personalDetails: input.updates.contact.personalDetails ?? undefined,
        professionalDetails: input.updates.contact.professionalDetails ?? undefined,
        location: input.updates.contact.location ?? undefined,
      } as ContactToCreateDTO;

      const geoResult = await this.updateContactsByExtKeys.handleAsync({
        contacts: [contactToCreate],
      });
      if (!geoResult.success || !geoResult.data) {
        return D2Result.bubbleFail(geoResult);
      }

      newGeoContact = geoResult.data.data[0];
      if (!newGeoContact) {
        return D2Result.bubbleFail(geoResult);
      }
    }

    // Apply metadata updates via domain function
    const metadataUpdates: UpdateOrgContactInput = {};
    if (input.updates.label !== undefined) {
      (metadataUpdates as Record<string, unknown>).label = input.updates.label;
    }
    if (input.updates.isPrimary !== undefined) {
      (metadataUpdates as Record<string, unknown>).isPrimary = input.updates.isPrimary;
    }

    const updated = updateOrgContact(existing, metadataUpdates);
    await this.repo.update(updated);

    return D2Result.ok({
      data: { contact: updated, geoContact: newGeoContact },
      traceId: this.traceId,
    });
  }
}
