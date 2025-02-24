import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from "@shared/schema";

// Configure neon to use the ws package
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Create a new pool with better error handling and connection management
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: true
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error(`Unexpected error on idle client: ${err.message}`);
});

// Add connection error handling
pool.on('connect', () => {
  console.log('Successfully connected to database');
});

// Test database connection
async function testConnection() {
  try {
    console.log('Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as test');
    console.log('Database connection test successful:', result.rows[0]);
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Initialize connection test
testConnection();

export const db = drizzle(pool, { schema });