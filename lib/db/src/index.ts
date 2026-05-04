import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export * from "./schema/index";
export { schema };

let pool: pg.Pool | null = null;

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://tradej:tradej@localhost:5432/tradej";
  pool = new pg.Pool({ connectionString });
  return pool;
}

export function getDb(): Database {
  return drizzle(getPool(), { schema });
}
