import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoServiceClient, GetContactsResponse, ContactDTO } from "@d2/protos";
import type { MemoryCacheStore } from "@d2/cache-memory";
import { Queries } from "../../interfaces/index.js";

type Input = Queries.GetContactsByIdsInput;
type Output = Queries.GetContactsByIdsOutput;

/**
 * Handler for fetching Geo contacts by their direct IDs with local cache-aside.
 * Contacts are immutable, so cached entries never expire (only LRU eviction).
 * Fail-open: returns whatever was cached if gRPC fails.
 */
export class GetContactsByIds
  extends BaseHandler<Input, Output>
  implements Queries.IGetContactsByIdsHandler
{
  override get redaction() {
    return Queries.GET_CONTACTS_BY_IDS_REDACTION;
  }

  private readonly store: MemoryCacheStore;
  private readonly geoClient: GeoServiceClient;

  constructor(store: MemoryCacheStore, geoClient: GeoServiceClient, context: IHandlerContext) {
    super(context);
    this.store = store;
    this.geoClient = geoClient;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    if (input.ids.length === 0) {
      return D2Result.ok({ data: { data: new Map() } });
    }

    const result = new Map<string, ContactDTO>();
    const missingIds: string[] = [];

    // Check cache first
    for (const id of input.ids) {
      const cacheKey = `contact:${id}`;
      const cached = this.store.get<ContactDTO>(cacheKey);
      if (cached !== undefined) {
        result.set(id, cached);
      } else {
        missingIds.push(id);
      }
    }

    // All cached — return early
    if (missingIds.length === 0) {
      return D2Result.ok({ data: { data: result } });
    }

    // Fetch cache misses from Geo service
    let response: GetContactsResponse;
    try {
      response = await new Promise<GetContactsResponse>((resolve, reject) => {
        this.geoClient.getContacts({ ids: missingIds }, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    } catch {
      // Fail-open: return whatever was cached
      this.context.logger.warn(
        `gRPC call to Geo service failed for GetContactsByIds. TraceId: ${this.traceId}`,
      );
      return D2Result.ok({ data: { data: result } });
    }

    if (response.result?.success && response.data) {
      // Cache each fetched contact (no TTL — contacts are immutable, LRU evicts)
      for (const [id, contact] of Object.entries(response.data)) {
        const cacheKey = `contact:${id}`;
        this.store.set(cacheKey, contact);
        result.set(id, contact);
      }
    }

    return D2Result.ok({ data: { data: result } });
  }
}

export type {
  GetContactsByIdsInput,
  GetContactsByIdsOutput,
} from "../../interfaces/q/get-contacts-by-ids.js";
