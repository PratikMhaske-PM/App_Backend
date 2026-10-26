import { env } from './env';
import { getDatabase, IDatabase, RunResult } from '../database/sqlite';

/**
 * Global database proxy connected to the active SQLite instance.
 * Delegates to getDatabase() so that test suites can switch to in-memory
 * databases via resetDatabase() / getDatabase(':memory:') without modifying
 * production database records.
 */
export const db: IDatabase = {
  exec(sql: string): void {
    return getDatabase(env.DATABASE_PATH || 'database.sqlite').exec(sql);
  },
  run(sql: string, params?: unknown[]): RunResult {
    return getDatabase(env.DATABASE_PATH || 'database.sqlite').run(sql, params);
  },
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    return getDatabase(env.DATABASE_PATH || 'database.sqlite').query<T>(sql, params);
  },
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
    return getDatabase(env.DATABASE_PATH || 'database.sqlite').queryOne<T>(sql, params);
  },
  transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    return getDatabase(env.DATABASE_PATH || 'database.sqlite').transaction<T>(fn);
  },
  close(): void {
    return getDatabase(env.DATABASE_PATH || 'database.sqlite').close();
  },
};
