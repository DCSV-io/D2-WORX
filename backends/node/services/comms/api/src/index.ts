export { createCommsService } from "./composition-root.js";
export type { CommsServiceConfig } from "./composition-root.js";

// Exported for testing
export { createCommsGrpcService } from "./services/comms-grpc-service.js";
export { withApiKeyAuth } from "@d2/service-defaults/grpc";
export { channelPreferenceToProto } from "./mappers/channel-preference-mapper.js";
export { deliveryRequestToProto, deliveryAttemptToProto } from "./mappers/delivery-mapper.js";
