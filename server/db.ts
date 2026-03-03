import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Create a new pool with keepAlive disabled and timeout
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema });

export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.log('[DB] Connection pool closed');
  } catch (err) {
    console.error('[DB] Error closing pool:', err);
  }
}