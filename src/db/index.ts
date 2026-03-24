import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";
import { getRequiredEnv } from "../lib/env-helper";

let _client: Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Gets or creates the raw PostgreSQL client connection.
 *
 * Uses the `DATABASE_URL` environment variable for the connection string.
 * The client is created lazily on first call and reused for subsequent calls.
 *
 * @returns The postgres.js SQL client instance
 * @throws If the `DATABASE_URL` environment variable is not set
 */
function getClient(): Sql {
  if (!_client) {
    const connectionString = getRequiredEnv("DATABASE_URL");
    _client = postgres(connectionString);
  }
  return _client;
}

/**
 * Lazy-initialized Drizzle ORM database instance.
 *
 * Uses a `Proxy` pattern so that the actual database connection is not established
 * until the first property access (i.e., the first query). This means connection
 * errors will surface on the first actual query, not at module import time.
 *
 * The proxy delegates all property accesses to the underlying Drizzle instance,
 * creating it on demand if it does not yet exist.
 */
export const db: PostgresJsDatabase<typeof schema> = new Proxy(
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_, prop) {
      if (!_db) {
        _db = drizzle(getClient(), { schema });
      }
      return (_db as any)[prop];
    },
  }
);

/**
 * Initializes the database schema by creating tables if they do not exist.
 *
 * Creates the following in the `entitystarter` schema (all operations are idempotent):
 * 1. The `entitystarter` schema itself (`CREATE SCHEMA IF NOT EXISTS`)
 * 2. The `entitystarter.users` table with columns: `firebase_uid` (PK), `email`,
 *    `display_name`, `created_at`, `updated_at`
 * 3. The `entitystarter.histories` table with columns: `id` (UUID PK), `user_id` (FK to users),
 *    `datetime`, `value` (numeric 12,2), `created_at`, `updated_at`
 * 4. An index on `entitystarter.histories(user_id)` for efficient user-scoped queries
 *
 * This function uses raw SQL (not Drizzle migrations) and should be called once
 * at application startup. It is safe to call multiple times.
 *
 * @throws If the database connection fails or SQL execution errors
 */
export async function initDatabase() {
  const client = getClient();

  await client`CREATE SCHEMA IF NOT EXISTS entitystarter`;

  await client`
    CREATE TABLE IF NOT EXISTS entitystarter.users (
      firebase_uid VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255),
      display_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Entity tables (via @sudobility/entity_service)
  await client`
    CREATE TABLE IF NOT EXISTS entitystarter.entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_slug VARCHAR(50) NOT NULL UNIQUE,
      entity_type VARCHAR(20) NOT NULL DEFAULT 'personal',
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS entitystarter.entity_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_id UUID NOT NULL REFERENCES entitystarter.entities(id) ON DELETE CASCADE,
      user_id VARCHAR(128) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      is_active BOOLEAN NOT NULL DEFAULT true,
      joined_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS entitystarter_entity_members_entity_user_idx
    ON entitystarter.entity_members(entity_id, user_id)
  `;

  await client`
    CREATE TABLE IF NOT EXISTS entitystarter.entity_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_id UUID NOT NULL REFERENCES entitystarter.entities(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      invited_by_user_id VARCHAR(128) NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS entitystarter.histories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(128) NOT NULL REFERENCES entitystarter.users(firebase_uid) ON DELETE CASCADE,
      entity_id UUID NOT NULL REFERENCES entitystarter.entities(id) ON DELETE CASCADE,
      datetime TIMESTAMP NOT NULL,
      value NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Migration: add entity_id column if it doesn't exist (for existing databases)
  await client`
    ALTER TABLE entitystarter.histories
    ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entitystarter.entities(id) ON DELETE CASCADE
  `;

  await client`
    CREATE INDEX IF NOT EXISTS entitystarter_histories_user_idx
    ON entitystarter.histories(user_id)
  `;

  await client`
    CREATE INDEX IF NOT EXISTS entitystarter_histories_entity_idx
    ON entitystarter.histories(entity_id)
  `;

  console.warn("Database tables initialized");
}

/**
 * Closes the database connection and cleans up resources.
 *
 * Ends the underlying postgres.js client connection and resets both the client
 * and Drizzle instance to null. Safe to call even if no connection was established.
 */
export async function closeDatabase() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

export * from "./schema";
