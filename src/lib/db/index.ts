import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задан.");
  globalForDb.pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return globalForDb.pool;
}

export const db = drizzle(getPool(), { schema });
