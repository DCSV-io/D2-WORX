import type { TemplateWrapper } from "@d2/comms-domain";
import type { TemplateWrapperDTO } from "@d2/protos";

export function templateWrapperToProto(tpl: TemplateWrapper): TemplateWrapperDTO {
  return {
    id: tpl.id,
    name: tpl.name,
    channel: tpl.channel,
    subjectTemplate: tpl.subjectTemplate ?? undefined,
    bodyTemplate: tpl.bodyTemplate,
    active: tpl.active,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
  };
}
