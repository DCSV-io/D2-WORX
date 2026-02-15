import { eq, desc, count, max } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SignInEvent } from "@d2/auth-domain";
import { signInEvent } from "../schema/custom-tables.js";

/**
 * Drizzle-backed repository for sign_in_event records.
 */
export class SignInEventRepository {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase) {
    this.db = db;
  }

  async create(event: SignInEvent): Promise<void> {
    await this.db.insert(signInEvent).values({
      id: event.id,
      userId: event.userId,
      successful: event.successful,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      whoIsId: event.whoIsId,
      createdAt: event.createdAt,
    });
  }

  async findByUserId(userId: string, limit: number, offset: number): Promise<SignInEvent[]> {
    const rows = await this.db
      .select()
      .from(signInEvent)
      .where(eq(signInEvent.userId, userId))
      .orderBy(desc(signInEvent.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(toSignInEvent);
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(signInEvent)
      .where(eq(signInEvent.userId, userId));

    return result?.count ?? 0;
  }

  async getLatestEventDate(userId: string): Promise<Date | null> {
    const [result] = await this.db
      .select({ latest: max(signInEvent.createdAt) })
      .from(signInEvent)
      .where(eq(signInEvent.userId, userId));

    if (!result?.latest) {
      return null;
    }
    return result.latest instanceof Date ? result.latest : new Date(result.latest as string);
  }
}

function toSignInEvent(row: typeof signInEvent.$inferSelect): SignInEvent {
  return {
    id: row.id,
    userId: row.userId,
    successful: row.successful,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    whoIsId: row.whoIsId,
    createdAt: row.createdAt,
  };
}
