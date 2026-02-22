import { createServiceKey } from "@d2/di";
import type { GeoServiceClient } from "@d2/protos";
import type { Commands, Queries, Complex } from "./interfaces/index.js";

// --- Infrastructure ---

/** DI key for the gRPC GeoServiceClient (singleton). */
export const IGeoServiceClientKey = createServiceKey<GeoServiceClient>("GeoServiceClient");

// --- Commands ---

/** DI key for CreateContacts handler. */
export const ICreateContactsKey =
  createServiceKey<Commands.ICreateContactsHandler>("Geo.CreateContacts");

/** DI key for DeleteContactsByExtKeys handler. */
export const IDeleteContactsByExtKeysKey =
  createServiceKey<Commands.IDeleteContactsByExtKeysHandler>("Geo.DeleteContactsByExtKeys");

// --- Queries ---

/** DI key for GetContactsByExtKeys handler. */
export const IGetContactsByExtKeysKey = createServiceKey<Queries.IGetContactsByExtKeysHandler>(
  "Geo.GetContactsByExtKeys",
);

// --- Complex ---

/** DI key for FindWhoIs handler. */
export const IFindWhoIsKey = createServiceKey<Complex.IFindWhoIsHandler>("Geo.FindWhoIs");

/** DI key for UpdateContactsByExtKeys handler. */
export const IUpdateContactsByExtKeysKey =
  createServiceKey<Complex.IUpdateContactsByExtKeysHandler>("Geo.UpdateContactsByExtKeys");
