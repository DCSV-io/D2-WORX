import { describe, it, expect } from "vitest";
import {
  D2ResultProtoFns,
  InputErrorProtoFns,
  PingServiceService,
  GeoServiceService,
  type D2ResultProto,
  type InputErrorProto,
  type PingRequest,
  type PingResponse,
  type CountryDTO,
  type SubdivisionDTO,
  type CurrencyDTO,
  type LanguageDTO,
  type LocaleDTO,
  type GeopoliticalEntityDTO,
  type CoordinatesDTO,
  type StreetAddressDTO,
  type LocationDTO,
  type WhoIsDTO,
  type ContactDTO,
  type ContactToCreateDTO,
  type GeoRefData,
  type FindWhoIsKeys,
  type FindWhoIsData,
  type EmailAddressDTO,
  type PhoneNumberDTO,
  type PersonalDTO,
  type ProfessionalDTO,
  type ContactMethodsDTO,
  type Timestamp,
} from "@d2/protos";

// ---------------------------------------------------------------------------
// D2ResultProto encode/decode roundtrip
// ---------------------------------------------------------------------------

describe("D2ResultProto", () => {
  it("roundtrips a success result", () => {
    const original: D2ResultProto = {
      success: true,
      statusCode: 200,
      errorCode: "",
      traceId: "550e8400-e29b-41d4-a716-446655440000",
      messages: [],
      inputErrors: [],
    };

    const encoded = D2ResultProtoFns.encode(original).finish();
    const decoded = D2ResultProtoFns.decode(encoded);

    expect(decoded.success).toBe(true);
    expect(decoded.statusCode).toBe(200);
    expect(decoded.traceId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(decoded.messages).toEqual([]);
    expect(decoded.inputErrors).toEqual([]);
  });

  it("roundtrips a failure result with messages", () => {
    const original: D2ResultProto = {
      success: false,
      statusCode: 400,
      errorCode: "VALIDATION_FAILED",
      traceId: "test-trace-id",
      messages: ["Something went wrong", "Another error"],
      inputErrors: [
        { field: "email", errors: ["Required", "Invalid format"] },
        { field: "name", errors: ["Too short"] },
      ],
    };

    const encoded = D2ResultProtoFns.encode(original).finish();
    const decoded = D2ResultProtoFns.decode(encoded);

    expect(decoded.success).toBe(false);
    expect(decoded.statusCode).toBe(400);
    expect(decoded.errorCode).toBe("VALIDATION_FAILED");
    expect(decoded.messages).toEqual(["Something went wrong", "Another error"]);
    expect(decoded.inputErrors).toHaveLength(2);
    expect(decoded.inputErrors[0]!.field).toBe("email");
    expect(decoded.inputErrors[0]!.errors).toEqual(["Required", "Invalid format"]);
    expect(decoded.inputErrors[1]!.field).toBe("name");
    expect(decoded.inputErrors[1]!.errors).toEqual(["Too short"]);
  });

  it("creates from partial with defaults", () => {
    const result = D2ResultProtoFns.create({ success: true, statusCode: 200 });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.errorCode).toBe("");
    expect(result.traceId).toBe("");
    expect(result.messages).toEqual([]);
    expect(result.inputErrors).toEqual([]);
  });

  it("roundtrips via JSON", () => {
    const original: D2ResultProto = {
      success: false,
      statusCode: 404,
      errorCode: "NOT_FOUND",
      traceId: "json-trace",
      messages: ["Resource not found"],
      inputErrors: [],
    };

    const json = D2ResultProtoFns.toJSON(original);
    const restored = D2ResultProtoFns.fromJSON(json);

    expect(restored.success).toBe(false);
    expect(restored.statusCode).toBe(404);
    expect(restored.errorCode).toBe("NOT_FOUND");
    expect(restored.traceId).toBe("json-trace");
    expect(restored.messages).toEqual(["Resource not found"]);
  });
});

// ---------------------------------------------------------------------------
// InputErrorProto encode/decode roundtrip
// ---------------------------------------------------------------------------

describe("InputErrorProto", () => {
  it("roundtrips field with errors", () => {
    const original: InputErrorProto = {
      field: "phoneNumber",
      errors: ["Invalid format", "Too short"],
    };

    const encoded = InputErrorProtoFns.encode(original).finish();
    const decoded = InputErrorProtoFns.decode(encoded);

    expect(decoded.field).toBe("phoneNumber");
    expect(decoded.errors).toEqual(["Invalid format", "Too short"]);
  });
});

// ---------------------------------------------------------------------------
// PingService definition
// ---------------------------------------------------------------------------

describe("PingServiceService", () => {
  it("has correct service path", () => {
    expect(PingServiceService.ping.path).toBe("/d2.common.v1.PingService/Ping");
  });

  it("is unary (no streaming)", () => {
    expect(PingServiceService.ping.requestStream).toBe(false);
    expect(PingServiceService.ping.responseStream).toBe(false);
  });

  it("serializes and deserializes PingRequest", () => {
    const request: PingRequest = { message: "hello" };
    const serialized = PingServiceService.ping.requestSerialize(request);
    const deserialized = PingServiceService.ping.requestDeserialize(serialized);
    expect(deserialized.message).toBe("hello");
  });

  it("serializes and deserializes PingResponse", () => {
    const response: PingResponse = {
      message: "pong",
      timestamp: "1234567890",
    };
    const serialized = PingServiceService.ping.responseSerialize(response);
    const deserialized = PingServiceService.ping.responseDeserialize(serialized);
    expect(deserialized.message).toBe("pong");
    expect(deserialized.timestamp).toBe("1234567890");
  });
});

// ---------------------------------------------------------------------------
// GeoService definition
// ---------------------------------------------------------------------------

describe("GeoServiceService", () => {
  it("has all 9 RPC methods", () => {
    const methods = Object.keys(GeoServiceService);
    expect(methods).toEqual([
      "getReferenceData",
      "requestReferenceDataUpdate",
      "findWhoIs",
      "getContacts",
      "deleteContacts",
      "getContactsByExtKeys",
      "createContacts",
      "deleteContactsByExtKeys",
      "updateContactsByExtKeys",
    ]);
  });

  it("has correct service paths", () => {
    expect(GeoServiceService.getReferenceData.path).toBe("/d2.geo.v1.GeoService/GetReferenceData");
    expect(GeoServiceService.findWhoIs.path).toBe("/d2.geo.v1.GeoService/FindWhoIs");
    expect(GeoServiceService.getContacts.path).toBe("/d2.geo.v1.GeoService/GetContacts");
    expect(GeoServiceService.createContacts.path).toBe("/d2.geo.v1.GeoService/CreateContacts");
    expect(GeoServiceService.deleteContacts.path).toBe("/d2.geo.v1.GeoService/DeleteContacts");
  });

  it("all methods are unary", () => {
    for (const method of Object.values(GeoServiceService)) {
      expect(method.requestStream).toBe(false);
      expect(method.responseStream).toBe(false);
    }
  });

  it("FindWhoIs roundtrips through serialization", () => {
    const request = {
      requests: [{ ipAddress: "192.168.1.1", fingerprint: "test-fp" }],
    };
    const serialized = GeoServiceService.findWhoIs.requestSerialize(request);
    const deserialized = GeoServiceService.findWhoIs.requestDeserialize(serialized);
    expect(deserialized.requests).toHaveLength(1);
    expect(deserialized.requests[0]!.ipAddress).toBe("192.168.1.1");
    expect(deserialized.requests[0]!.fingerprint).toBe("test-fp");
  });
});

// ---------------------------------------------------------------------------
// Geo DTO type shape verification
// ---------------------------------------------------------------------------

describe("Geo DTO interfaces", () => {
  it("CountryDTO has expected fields", () => {
    const country: CountryDTO = {
      iso31661Alpha2Code: "US",
      iso31661Alpha3Code: "USA",
      iso31661NumericCode: "840",
      displayName: "United States",
      officialName: "United States of America",
      phoneNumberPrefix: "+1",
      phoneNumberFormat: "",
      sovereignIso31661Alpha2Code: "US",
      primaryCurrencyIso4217AlphaCode: "USD",
      primaryLocaleIetfBcp47Tag: "en-US",
      territoryIso31661Alpha2Codes: [],
      subdivisionIso31662Codes: ["US-CA", "US-NY"],
      currencyIso4217AlphaCodes: ["USD"],
      localeIetfBcp47Tags: ["en-US"],
      geopoliticalEntityShortCodes: ["NATO", "G7"],
    };

    expect(country.iso31661Alpha2Code).toBe("US");
    expect(country.subdivisionIso31662Codes).toContain("US-CA");
  });

  it("WhoIsDTO has network flags", () => {
    const whois: WhoIsDTO = {
      hashId: "abc123",
      ipAddress: "192.168.1.1",
      year: 2025,
      month: 6,
      fingerprint: "test-fp",
      asn: 15169,
      asName: "Google",
      asDomain: "google.com",
      asType: "isp",
      carrierName: "",
      mcc: "",
      mnc: "",
      asChanged: "",
      geoChanged: "",
      isAnonymous: false,
      isAnycast: false,
      isHosting: false,
      isMobile: false,
      isSatellite: false,
      isProxy: false,
      isRelay: false,
      isTor: false,
      isVpn: false,
      privacyName: "",
      location: undefined,
    };

    expect(whois.ipAddress).toBe("192.168.1.1");
    expect(whois.asn).toBe(15169);
    expect(whois.isVpn).toBe(false);
  });

  it("LocationDTO has coordinates and address", () => {
    const location: LocationDTO = {
      hashId: "loc-hash-123",
      coordinates: { latitude: 34.0522, longitude: -118.2437 },
      address: { line1: "123 Main St", line2: "", line3: "" },
      city: "Los Angeles",
      postalCode: "90001",
      subdivisionIso31662Code: "US-CA",
      countryIso31661Alpha2Code: "US",
    };

    expect(location.coordinates!.latitude).toBe(34.0522);
    expect(location.city).toBe("Los Angeles");
  });

  it("ContactDTO has nested DTOs", () => {
    const contact: ContactDTO = {
      id: "contact-1",
      createdAt: undefined,
      contextKey: "user",
      relatedEntityId: "user-123",
      contactMethods: {
        emails: [{ value: "test@example.com", labels: ["primary"] }],
        phoneNumbers: [{ value: "5551234567", labels: ["mobile"] }],
      },
      personalDetails: {
        title: "Mr",
        firstName: "John",
        preferredName: "Johnny",
        middleName: "",
        lastName: "Doe",
        generationalSuffix: "",
        professionalCredentials: [],
        dateOfBirth: "1990-01-01",
        biologicalSex: "M",
      },
      professionalDetails: {
        companyName: "Acme",
        jobTitle: "Engineer",
        department: "Dev",
        companyWebsite: "https://acme.com",
      },
      location: undefined,
    };

    expect(contact.id).toBe("contact-1");
    expect(contact.contactMethods!.emails).toHaveLength(1);
    expect(contact.personalDetails!.firstName).toBe("John");
  });

  it("GeoRefData has all reference data maps", () => {
    const refData: GeoRefData = {
      version: "1.0.0",
      updatedAt: undefined,
      countries: {},
      subdivisions: {},
      currencies: {},
      languages: {},
      locales: {},
      geopoliticalEntities: {},
    };

    expect(refData.version).toBe("1.0.0");
    expect(refData.countries).toEqual({});
  });

  it("FindWhoIsKeys has required fields", () => {
    const keys: FindWhoIsKeys = {
      ipAddress: "10.0.0.1",
      fingerprint: "browser-fp-hash",
    };

    expect(keys.ipAddress).toBe("10.0.0.1");
    expect(keys.fingerprint).toBe("browser-fp-hash");
  });
});

// ---------------------------------------------------------------------------
// Cross-file import verification (geo → d2_result)
// ---------------------------------------------------------------------------

describe("Cross-proto imports", () => {
  it("FindWhoIsResponse includes D2ResultProto", () => {
    // Verify that the generated geo types reference common types correctly
    // by serializing a response that includes a D2ResultProto.
    const response = {
      result: {
        success: true,
        statusCode: 200,
        errorCode: "",
        traceId: "cross-import-test",
        messages: [],
        inputErrors: [],
      },
      data: [
        {
          key: { ipAddress: "1.2.3.4", fingerprint: "fp" },
          whois: {
            hashId: "whois-hash",
            ipAddress: "1.2.3.4",
            year: 2025,
            month: 1,
            fingerprint: "fp",
            asn: 0,
            asName: "",
            asDomain: "",
            asType: "",
            carrierName: "",
            mcc: "",
            mnc: "",
            asChanged: "",
            geoChanged: "",
            isAnonymous: false,
            isAnycast: false,
            isHosting: false,
            isMobile: false,
            isSatellite: false,
            isProxy: false,
            isRelay: false,
            isTor: false,
            isVpn: false,
            privacyName: "",
            location: undefined,
          },
        },
      ],
    };

    const serialized = GeoServiceService.findWhoIs.responseSerialize(response);
    const deserialized = GeoServiceService.findWhoIs.responseDeserialize(serialized);

    expect(deserialized.result!.success).toBe(true);
    expect(deserialized.result!.statusCode).toBe(200);
    expect(deserialized.result!.traceId).toBe("cross-import-test");
    expect(deserialized.data).toHaveLength(1);
    expect(deserialized.data[0]!.key!.ipAddress).toBe("1.2.3.4");
    expect(deserialized.data[0]!.whois!.hashId).toBe("whois-hash");
  });
});
