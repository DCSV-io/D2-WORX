import type { IHandler } from "@d2/handler";

export interface UpdateOrgLogoInput {
  readonly orgId: string;
  readonly logo: string | null;
}

export interface UpdateOrgLogoOutput {}

export type IUpdateOrgLogoHandler = IHandler<UpdateOrgLogoInput, UpdateOrgLogoOutput>;
