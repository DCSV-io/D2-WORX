import type { ServiceCollection } from "@d2/di";
import type { HandlerContext } from "@d2/handler";
import type { ILogger } from "@d2/logging";
import { IEmailProviderKey, ISmsProviderKey } from "@d2/comms-app";
import { ResendEmailProvider, TwilioSmsProvider } from "@d2/comms-infra";

export interface ProviderConfig {
  resendApiKey?: string;
  resendFromAddress?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

/**
 * Registers email and SMS delivery providers as singleton instances.
 * Logs warnings when credentials are missing (graceful degradation).
 */
export function addDeliveryProviders(
  services: ServiceCollection,
  config: ProviderConfig,
  serviceContext: HandlerContext,
  logger: ILogger,
): void {
  if (config.resendApiKey && config.resendFromAddress) {
    services.addInstance(
      IEmailProviderKey,
      new ResendEmailProvider(config.resendApiKey, config.resendFromAddress, serviceContext),
    );
  } else {
    logger.warn("No Resend API key configured — email delivery disabled");
  }

  if (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) {
    services.addInstance(
      ISmsProviderKey,
      new TwilioSmsProvider(
        config.twilioAccountSid,
        config.twilioAuthToken,
        config.twilioPhoneNumber,
        serviceContext,
      ),
    );
  } else {
    logger.warn("No Twilio credentials configured — SMS delivery disabled");
  }
}
