import type { RequestEnrichment } from "@d2/interfaces";

/**
 * Concrete implementation of IRequestInfo.
 * Mirrors D2.Shared.RequestEnrichment.Default.RequestInfo in .NET.
 */
export class RequestInfo implements RequestEnrichment.IRequestInfo {
  readonly clientIp: string;
  readonly serverFingerprint: string;
  readonly clientFingerprint: string | undefined;
  readonly whoIsHashId: string | undefined;
  readonly city: string | undefined;
  readonly countryCode: string | undefined;
  readonly subdivisionCode: string | undefined;
  readonly isVpn: boolean | undefined;
  readonly isProxy: boolean | undefined;
  readonly isTor: boolean | undefined;
  readonly isHosting: boolean | undefined;
  userId: string | undefined;
  isAuthenticated: boolean;

  constructor(params: {
    clientIp: string;
    serverFingerprint: string;
    clientFingerprint?: string;
    whoIsHashId?: string;
    city?: string;
    countryCode?: string;
    subdivisionCode?: string;
    isVpn?: boolean;
    isProxy?: boolean;
    isTor?: boolean;
    isHosting?: boolean;
    userId?: string;
    isAuthenticated?: boolean;
  }) {
    this.clientIp = params.clientIp;
    this.serverFingerprint = params.serverFingerprint;
    this.clientFingerprint = params.clientFingerprint;
    this.whoIsHashId = params.whoIsHashId;
    this.city = params.city;
    this.countryCode = params.countryCode;
    this.subdivisionCode = params.subdivisionCode;
    this.isVpn = params.isVpn;
    this.isProxy = params.isProxy;
    this.isTor = params.isTor;
    this.isHosting = params.isHosting;
    this.userId = params.userId;
    this.isAuthenticated = params.isAuthenticated ?? false;
  }
}
