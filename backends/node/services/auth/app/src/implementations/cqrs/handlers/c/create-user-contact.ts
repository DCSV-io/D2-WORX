import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid, zodNonEmptyString } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { ContactDTO, ContactToCreateDTO } from "@d2/protos";
import { GEO_CONTEXT_KEYS } from "@d2/auth-domain";
import type { Commands } from "@d2/geo-client";

export interface CreateUserContactInput {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
}

export interface CreateUserContactOutput {
  readonly contact: ContactDTO;
}

const schema = z.object({
  userId: zodGuid,
  email: zodNonEmptyString(320), // RFC 5321 max
  name: zodNonEmptyString(200),
});

/**
 * Creates a Geo contact for a newly registered user.
 *
 * Called during sign-up BEFORE the user record is persisted
 * (Contact BEFORE User pattern). Uses contextKey="auth_user" and
 * relatedEntityId=userId so downstream services (comms) can
 * resolve the user's contact details via Geo.
 *
 * Fail-fast: if Geo is unavailable, sign-up fails entirely
 * (no stale users without contacts).
 */
export class CreateUserContact extends BaseHandler<
  CreateUserContactInput,
  CreateUserContactOutput
> {
  private readonly createContacts: Commands.ICreateContactsHandler;

  constructor(createContacts: Commands.ICreateContactsHandler, context: IHandlerContext) {
    super(context);
    this.createContacts = createContacts;
  }

  protected async executeAsync(
    input: CreateUserContactInput,
  ): Promise<D2Result<CreateUserContactOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const contactToCreate: ContactToCreateDTO = {
      createdAt: new Date(),
      contextKey: GEO_CONTEXT_KEYS.USER,
      relatedEntityId: input.userId,
      contactMethods: {
        emails: [{ value: input.email, labels: [] }],
        phoneNumbers: [],
      },
      personalDetails: {
        firstName: input.name,
        lastName: "",
        title: "",
        preferredName: "",
        middleName: "",
        generationalSuffix: "",
        professionalCredentials: [],
        dateOfBirth: "",
        biologicalSex: "",
      },
      professionalDetails: undefined,
      location: undefined,
    };

    const result = await this.createContacts.handleAsync({ contacts: [contactToCreate] });
    if (!result.success || !result.data) return D2Result.bubbleFail(result);

    const contact = result.data.data[0];
    if (!contact) return D2Result.bubbleFail(result);

    return D2Result.ok({ data: { contact } });
  }
}
