// Common types
export type { D2ResultProto, InputErrorProto } from "./generated/common/v1/d2_result.js";

export {
  D2ResultProto as D2ResultProtoFns,
  InputErrorProto as InputErrorProtoFns,
} from "./generated/common/v1/d2_result.js";

// Ping service
export type {
  PingRequest,
  PingResponse,
  PingServiceClient,
  PingServiceServer,
} from "./generated/common/v1/ping.js";

export {
  PingServiceClient as PingServiceClientCtor,
  PingServiceService,
} from "./generated/common/v1/ping.js";

// Geo service — DTOs
export type {
  CountryDTO,
  SubdivisionDTO,
  CurrencyDTO,
  LanguageDTO,
  LocaleDTO,
  GeopoliticalEntityDTO,
  CoordinatesDTO,
  StreetAddressDTO,
  EmailAddressDTO,
  PhoneNumberDTO,
  PersonalDTO,
  ProfessionalDTO,
  ContactMethodsDTO,
  LocationDTO,
  WhoIsDTO,
  ContactDTO,
  ContactToCreateDTO,
} from "./generated/geo/v1/geo.js";

// GeoRefData — value export (provides encode/decode for proto serialization)
export { GeoRefData } from "./generated/geo/v1/geo.js";

// Geo service — request/response types
export type {
  GetReferenceDataRequest,
  GetReferenceDataResponse,
  RequestReferenceDataUpdateRequest,
  RequestReferenceDataUpdateResponse,
  FindWhoIsRequest,
  FindWhoIsResponse,
  FindWhoIsKeys,
  FindWhoIsData,
  GetContactsRequest,
  GetContactsResponse,
  GetContactsByExtKeysRequest,
  GetContactsByExtKeysResponse,
  GetContactsExtKeys,
  GetContactsByExtKeysData,
  CreateContactsRequest,
  CreateContactsResponse,
  DeleteContactsRequest,
  DeleteContactsResponse,
  GeoServiceClient,
  GeoServiceServer,
} from "./generated/geo/v1/geo.js";

export {
  GeoServiceClient as GeoServiceClientCtor,
  GeoServiceService,
} from "./generated/geo/v1/geo.js";

// Timestamp (well-known type)
export type { Timestamp } from "./generated/google/protobuf/timestamp.js";
