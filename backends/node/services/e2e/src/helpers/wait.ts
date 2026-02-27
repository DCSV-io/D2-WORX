import type pg from "pg";

export interface WaitOptions {
  /** Max time to wait in ms (default: 15_000). */
  timeout?: number;
  /** Polling interval in ms (default: 200). */
  interval?: number;
  /** Description for timeout error message. */
  label?: string;
}

/**
 * Polls an async condition until it returns true or timeout is reached.
 * Throws on timeout with a descriptive message.
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options?: WaitOptions,
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;
  const interval = options?.interval ?? 200;
  const label = options?.label ?? "condition";

  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`waitFor("${label}") timed out after ${timeout}ms`);
}

/**
 * Polls until a SQL query returns at least one row.
 * Returns the first row when found.
 */
export async function waitForRow<T extends Record<string, unknown>>(
  pool: pg.Pool,
  query: string,
  params?: unknown[],
  options?: WaitOptions,
): Promise<T> {
  let result: T | undefined;

  await waitFor(
    async () => {
      const res = await pool.query(query, params);
      if (res.rows.length > 0) {
        result = res.rows[0] as T;
        return true;
      }
      return false;
    },
    { ...options, label: options?.label ?? `SQL: ${query.slice(0, 60)}` },
  );

  return result!;
}

/**
 * Polls until a SQL query returns at least `count` rows.
 * Returns all matching rows.
 */
export async function waitForRows<T extends Record<string, unknown>>(
  pool: pg.Pool,
  query: string,
  params: unknown[],
  count: number,
  options?: WaitOptions,
): Promise<T[]> {
  let rows: T[] = [];

  await waitFor(
    async () => {
      const res = await pool.query(query, params);
      if (res.rows.length >= count) {
        rows = res.rows as T[];
        return true;
      }
      return false;
    },
    { ...options, label: options?.label ?? `SQL (${count} rows): ${query.slice(0, 60)}` },
  );

  return rows;
}
