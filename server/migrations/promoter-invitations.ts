import { db } from "../db";
import { sql } from "drizzle-orm";

/** Safe to run on every boot; CREATE/ALTER statements are idempotent. */
export async function ensurePromoterInvitationSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS promoter_invitations (
      id SERIAL PRIMARY KEY,
      organization_name TEXT NOT NULL,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS promoter_invitations_email_status_idx ON promoter_invitations (email, status)`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS advertiser_profiles_user_id_unique
    ON advertiser_profiles (user_id)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS promoter_invitations_one_active_email
    ON promoter_invitations (email)
    WHERE status = 'active'
  `);
}