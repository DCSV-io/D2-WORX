import type { Kysely } from "kysely";
import type { SignInEvent } from "@d2/auth-domain";
import type { AuthCustomDatabase, NewSignInEvent } from "../entities/kysely-types.js";

/**
 * Kysely-based repository for sign_in_event records.
 */
export class SignInEventRepository {
  private readonly db: Kysely<AuthCustomDatabase>;

  constructor(db: Kysely<AuthCustomDatabase>) {
    this.db = db;
  }

  async create(event: SignInEvent): Promise<void> {
    const row: NewSignInEvent = {
      id: event.id,
      user_id: event.userId,
      successful: event.successful,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      who_is_id: event.whoIsId,
      created_at: event.createdAt,
    };

    await this.db.insertInto("sign_in_event").values(row).execute();
  }

  async findByUserId(userId: string, limit: number, offset: number): Promise<SignInEvent[]> {
    const rows = await this.db
      .selectFrom("sign_in_event")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return rows.map(toSignInEvent);
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.db
      .selectFrom("sign_in_event")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();

    return Number(result.count);
  }

  async getLatestEventDate(userId: string): Promise<Date | null> {
    const result = await this.db
      .selectFrom("sign_in_event")
      .select((eb) => eb.fn.max("created_at").as("latest"))
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!result || result.latest === null || result.latest === undefined) {
      return null;
    }
    return result.latest instanceof Date ? result.latest : new Date(result.latest as string);
  }
}

function toSignInEvent(row: {
  id: string;
  user_id: string;
  successful: boolean;
  ip_address: string;
  user_agent: string;
  who_is_id: string | null;
  created_at: Date;
}): SignInEvent {
  return {
    id: row.id,
    userId: row.user_id,
    successful: row.successful,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    whoIsId: row.who_is_id,
    createdAt: row.created_at,
  };
}
