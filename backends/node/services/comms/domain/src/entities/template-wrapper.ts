import { cleanStr, generateUuidV7 } from "@d2/utilities";
import type { Channel } from "../enums/channel.js";
import { isValidChannel } from "../enums/channel.js";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";

/**
 * Wraps a delivery template for a specific channel.
 *
 * Templates contain subject and body patterns with placeholders
 * that are rendered at delivery time with message content.
 */
export interface TemplateWrapper {
  readonly id: string;
  readonly name: string;
  readonly channel: Channel;
  readonly subjectTemplate: string | null;
  readonly bodyTemplate: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTemplateWrapperInput {
  readonly name: string;
  readonly channel: Channel;
  readonly bodyTemplate: string;
  readonly id?: string;
  readonly subjectTemplate?: string | null;
  readonly active?: boolean;
}

export interface UpdateTemplateWrapperInput {
  readonly name?: string;
  readonly subjectTemplate?: string | null;
  readonly bodyTemplate?: string;
  readonly active?: boolean;
}

/**
 * Creates a new template wrapper.
 */
export function createTemplateWrapper(input: CreateTemplateWrapperInput): TemplateWrapper {
  const name = cleanStr(input.name);
  if (!name) {
    throw new CommsValidationError("TemplateWrapper", "name", input.name, "is required.");
  }

  if (!isValidChannel(input.channel)) {
    throw new CommsValidationError(
      "TemplateWrapper",
      "channel",
      input.channel,
      "is not a valid channel.",
    );
  }

  const bodyTemplate = cleanStr(input.bodyTemplate);
  if (!bodyTemplate) {
    throw new CommsValidationError(
      "TemplateWrapper",
      "bodyTemplate",
      input.bodyTemplate,
      "is required.",
    );
  }

  const subjectTemplate = input.subjectTemplate != null
    ? cleanStr(input.subjectTemplate) ?? null
    : null;

  const now = new Date();

  return {
    id: input.id ?? generateUuidV7(),
    name,
    channel: input.channel,
    subjectTemplate,
    bodyTemplate,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates mutable template fields. Channel is immutable after creation.
 */
export function updateTemplateWrapper(
  tpl: TemplateWrapper,
  updates: UpdateTemplateWrapperInput,
): TemplateWrapper {
  let name = tpl.name;
  if (updates.name !== undefined) {
    const cleaned = cleanStr(updates.name);
    if (!cleaned) {
      throw new CommsValidationError("TemplateWrapper", "name", updates.name, "is required.");
    }
    name = cleaned;
  }

  let bodyTemplate = tpl.bodyTemplate;
  if (updates.bodyTemplate !== undefined) {
    const cleaned = cleanStr(updates.bodyTemplate);
    if (!cleaned) {
      throw new CommsValidationError(
        "TemplateWrapper",
        "bodyTemplate",
        updates.bodyTemplate,
        "is required.",
      );
    }
    bodyTemplate = cleaned;
  }

  return {
    ...tpl,
    name,
    subjectTemplate:
      updates.subjectTemplate !== undefined
        ? (cleanStr(updates.subjectTemplate ?? "") ?? null)
        : tpl.subjectTemplate,
    bodyTemplate,
    active: updates.active ?? tpl.active,
    updatedAt: new Date(),
  };
}
