import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid, zodNonEmptyString } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { ContactToCreateDTO } from "@d2/protos";
import { GEO_CONTEXT_KEYS } from "@d2/auth-domain";
import type { Commands as GeoCommands } from "@d2/geo-client";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";

type Input = Commands.CreateUserContactInput;
type Output = Commands.CreateUserContactOutput;

const schema = z.object({
  userId: zodGuid,
  email: zodNonEmptyString(254), // Geo contact-schemas max
  name: zodNonEmptyString(511), // firstName(255) + " " + lastName(255)
  locale: zodNonEmptyString(35), // BCP 47 tag (e.g. "en", "fr-CA")
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
export class CreateUserContact
  extends BaseHandler<Input, Output>
  implements Commands.ICreateUserContactHandler
{
  private readonly createContacts: GeoCommands.ICreateContactsHandler;

  constructor(createContacts: GeoCommands.ICreateContactsHandler, context: IHandlerContext) {
    super(context);
    this.createContacts = createContacts;
  }

  override get redaction() {
    return Commands.CREATE_USER_CONTACT_REDACTION;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // Split combined name into firstName/lastName, capping each at Geo's varchar(255).
    const spaceIndex = input.name.indexOf(" ");
    const firstName =
      spaceIndex >= 0 ? input.name.slice(0, spaceIndex).slice(0, 255) : input.name.slice(0, 255);
    const lastName = spaceIndex >= 0 ? input.name.slice(spaceIndex + 1).slice(0, 255) : "";

    const contactToCreate: ContactToCreateDTO = {
      createdAt: new Date(),
      contextKey: GEO_CONTEXT_KEYS.USER,
      relatedEntityId: input.userId,
      contactMethods: {
        emails: [{ value: input.email, labels: [] }],
        phoneNumbers: [],
      },
      personalDetails: {
        firstName,
        lastName,
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
      ietfBcp47Tag: input.locale,
    };

    const result = await this.createContacts.handleAsync({ contacts: [contactToCreate] });
    if (!result.success || !result.data) return D2Result.bubbleFail(result);

    const contact = result.data.data[0];
    if (!contact) return D2Result.bubbleFail(result);

    return D2Result.ok({ data: { contact } });
  }
}

export type {
  CreateUserContactInput,
  CreateUserContactOutput,
} from "../../../../interfaces/cqrs/handlers/c/create-user-contact.js";
