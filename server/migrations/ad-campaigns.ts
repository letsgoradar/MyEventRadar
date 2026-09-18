import { sql } from "drizzle-orm";
import { db } from "../db";

/** Safe to run at every boot; legacy rows are keyed to prevent duplicate backfills. */
export async function ensureAdCampaignSchema() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(470047)`);
    await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id SERIAL PRIMARY KEY, advertiser_id INTEGER NOT NULL REFERENCES advertiser_profiles(id) ON DELETE CASCADE,
      ad_id INTEGER NOT NULL REFERENCES business_ads(id) ON DELETE CASCADE, name TEXT NOT NULL,
      legacy_business_ad_id INTEGER UNIQUE REFERENCES business_ads(id) ON DELETE SET NULL,
      legacy_event_promotion_id INTEGER UNIQUE REFERENCES event_promotions(id) ON DELETE SET NULL,
      placement TEXT NOT NULL, destination_type TEXT NOT NULL, venue_id INTEGER, event_id INTEGER,
      destination_url TEXT, start_date TIMESTAMP NOT NULL, end_date TIMESTAMP NOT NULL,
      budget_cents INTEGER NOT NULL, spent_cents INTEGER NOT NULL DEFAULT 0, target_radius_km INTEGER NOT NULL DEFAULT 10,
      target_categories TEXT[], status TEXT NOT NULL DEFAULT 'draft', pricing_model TEXT NOT NULL DEFAULT 'cpm',
      unit_price_cents INTEGER NOT NULL, impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0,
      closes INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY, advertiser_id INTEGER NOT NULL REFERENCES advertiser_profiles(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL, type TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
      stripe_payment_intent_id TEXT UNIQUE, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ad_interactions (
      id SERIAL PRIMARY KEY, campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      type TEXT NOT NULL, user_id INTEGER, event_id INTEGER, idempotency_key TEXT UNIQUE,
      cost_cents INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS legacy_business_ad_id INTEGER UNIQUE REFERENCES business_ads(id) ON DELETE SET NULL;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS legacy_event_promotion_id INTEGER UNIQUE REFERENCES event_promotions(id) ON DELETE SET NULL;
    INSERT INTO ad_campaigns (
      advertiser_id, ad_id, legacy_business_ad_id, name, placement, destination_type, destination_url,
      start_date, end_date, budget_cents, spent_cents, target_radius_km, target_categories, status,
      pricing_model, unit_price_cents, impressions, clicks, created_at
    )
    SELECT
      ba.advertiser_id, ba.id, ba.id, ba.title, 'external_interstitial', 'website', ba.cta_url,
      ba.created_at, TIMESTAMP '2099-12-31 23:59:59', 2147483647, ba.total_spend_cents,
      ba.target_radius_km, ba.target_categories,
      CASE
        WHEN ba.status='active' THEN 'active'
        WHEN ba.status='paused' THEN 'paused'
        WHEN ba.status='exhausted' THEN 'exhausted'
        WHEN ba.status='pending' THEN 'pending'
        ELSE 'draft'
      END,
      'cpm', ba.cpm_cents, ba.impressions, ba.clicks, ba.created_at
    FROM business_ads ba
    WHERE NOT EXISTS (
      SELECT 1 FROM ad_campaigns c WHERE c.legacy_business_ad_id=ba.id
    );
    DO $$
    DECLARE p RECORD; creative_id INTEGER; skipped_count INTEGER;
    BEGIN
      FOR p IN SELECT ep.*, ap.id AS advertiser_id, e.title, e.image_url, e.external_url
        FROM event_promotions ep JOIN advertiser_profiles ap ON ap.user_id=ep.purchased_by_user_id
        LEFT JOIN events e ON e.id=ep.event_id
        WHERE NOT EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.legacy_event_promotion_id=ep.id)
      LOOP
        SELECT id INTO creative_id
        FROM business_ads
        WHERE advertiser_id=p.advertiser_id AND title='Legacy event promotion #'||p.id
        ORDER BY id LIMIT 1;
        IF creative_id IS NULL THEN
          INSERT INTO business_ads (advertiser_id,title,description,image_url,cta_url,target_radius_km,status,cpm_cents)
          VALUES (p.advertiser_id, 'Legacy event promotion #'||p.id, COALESCE(p.title,'Legacy event promotion'),
                  p.image_url, COALESCE(p.external_url,'https://evenementenradar.nl'), p.target_radius_km, 'pending', p.price_cents)
          RETURNING id INTO creative_id;
        END IF;
        INSERT INTO ad_campaigns (advertiser_id,ad_id,legacy_event_promotion_id,name,placement,destination_type,event_id,
          start_date,end_date,budget_cents,spent_cents,target_radius_km,status,pricing_model,unit_price_cents,
          impressions,clicks,created_at)
        VALUES (p.advertiser_id,creative_id,p.id,'Legacy event promotion #'||p.id,'event_boost','event',p.event_id,
          p.start_date,p.end_date,p.price_cents,p.price_cents,p.target_radius_km,
          CASE WHEN p.status='active' THEN 'active' WHEN p.status='expired' THEN 'expired' ELSE 'pending' END,
          'fixed',p.price_cents,p.impressions,p.clicks,p.created_at);
      END LOOP;
      SELECT COUNT(*) INTO skipped_count
      FROM event_promotions ep
      WHERE NOT EXISTS (SELECT 1 FROM advertiser_profiles ap WHERE ap.user_id=ep.purchased_by_user_id)
        AND NOT EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.legacy_event_promotion_id=ep.id);
      IF skipped_count > 0 THEN
        RAISE WARNING '% event promotions could not be migrated because their promoter profile is missing', skipped_count;
      END IF;
    END $$;
  `);
  });
}