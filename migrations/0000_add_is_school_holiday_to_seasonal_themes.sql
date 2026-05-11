CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"entity_id" integer,
	"entity_type" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_impressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" integer NOT NULL,
	"event_id" integer,
	"user_id" integer,
	"cost_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advertiser_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website_url" text,
	"address" text,
	"latitude" numeric,
	"longitude" numeric,
	"business_category" text NOT NULL,
	"phone" text,
	"stripe_customer_id" text,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"monthly_budget_cap_cents" integer,
	"current_month_spend_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_email" text,
	"email_verified" boolean DEFAULT false,
	"verification_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_assistant_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"week_start" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_assistant_usage_user_id_week_start_unique" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "ai_extraction_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"path_pattern" text,
	"selectors" jsonb NOT NULL,
	"pagination" jsonb,
	"confidence" integer DEFAULT 0 NOT NULL,
	"validated_events" integer DEFAULT 0,
	"requires_js_rendering" boolean DEFAULT false,
	"last_successful_at" timestamp,
	"last_validated_at" timestamp,
	"ai_model" text,
	"ai_prompt_version" text,
	"municipality" text,
	"sample_detail_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_extraction_profiles_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "api_usage_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"hour" timestamp NOT NULL,
	"endpoint" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"unique_ips" integer DEFAULT 0 NOT NULL,
	"blocked_requests" integer DEFAULT 0 NOT NULL,
	"avg_response_ms" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_usage_stats_hour_endpoint_unique" UNIQUE("hour","endpoint")
);
--> statement-breakpoint
CREATE TABLE "beta_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"page_url" text NOT NULL,
	"feedback_type" text NOT NULL,
	"message" text NOT NULL,
	"rating" integer,
	"email" text,
	"status" text DEFAULT 'nieuw' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiser_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"cta_url" text NOT NULL,
	"cta_text" text DEFAULT 'Meer info',
	"target_radius_km" integer DEFAULT 10 NOT NULL,
	"target_categories" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"cpm_cents" integer NOT NULL,
	"total_spend_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_audience_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"audience_id" integer NOT NULL,
	"is_auto_detected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_audience_mappings_event_id_audience_id_unique" UNIQUE("event_id","audience_id")
);
--> statement-breakpoint
CREATE TABLE "event_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"purchased_by_user_id" integer NOT NULL,
	"promotion_period" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"target_radius_km" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"price_cents" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"feed_id" integer,
	"source_url" text NOT NULL,
	"source_name" text NOT NULL,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tag_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"is_auto_detected" boolean DEFAULT false,
	"confidence" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_tag_mappings_event_id_tag_id_unique" UNIQUE("event_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "event_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text NOT NULL,
	"group" text NOT NULL,
	"keywords" text[] NOT NULL,
	"parent_category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "event_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "event_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_theme_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"theme_id" integer NOT NULL,
	"is_auto_detected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_theme_mappings_event_id_theme_id_unique" UNIQUE("event_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"latitude" numeric NOT NULL,
	"longitude" numeric NOT NULL,
	"address" text,
	"notification_reach" numeric NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"category" text NOT NULL,
	"secondary_category" text,
	"is_paid" boolean DEFAULT false,
	"price" numeric,
	"max_participants" integer,
	"host_id" integer,
	"recurrence" text DEFAULT 'once' NOT NULL,
	"tags" text[],
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_highlighted" boolean DEFAULT false,
	"highlight_start_date" timestamp,
	"highlight_end_date" timestamp,
	"highlight_priority" integer DEFAULT 0,
	"external_url" text,
	"external_page_opens" integer DEFAULT 0,
	"saves_count" integer DEFAULT 0,
	"detail_views" integer DEFAULT 0,
	"venue_id" integer,
	"event_tag_ids" integer[],
	"target_audience_ids" integer[],
	"seasonal_theme_ids" integer[],
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	CONSTRAINT "favorites_user_id_event_id_unique" UNIQUE("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "feed_analysis_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"feed_type" text,
	"detected_fields" jsonb,
	"field_mappings" jsonb,
	"sample_items" jsonb,
	"analysis_result" jsonb,
	"raw_content_sample" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"analyzed_at" timestamp,
	"analyzed_by" integer
);
--> statement-breakpoint
CREATE TABLE "feed_field_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"mappings" jsonb NOT NULL,
	"usage_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "feed_field_mappings_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "feed_quality_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"total_events_checked" integer DEFAULT 0,
	"events_with_issues" integer DEFAULT 0,
	"overall_score" integer,
	"used_gemini" boolean DEFAULT false,
	"gemini_sample_size" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_sync_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"total_found" integer DEFAULT 0,
	"after_merge" integer DEFAULT 0,
	"new_events" integer DEFAULT 0,
	"updated_events" integer DEFAULT 0,
	"incomplete_events" integer DEFAULT 0,
	"skipped_events" integer DEFAULT 0,
	"incomplete_reasons" jsonb,
	"error_message" text,
	"success" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "geocode_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_query" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"display_name" text,
	"municipality" text,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "geocode_cache_address_query_unique" UNIQUE("address_query")
);
--> statement-breakpoint
CREATE TABLE "hidden_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "hidden_events_user_event" UNIQUE("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"city_slug" text,
	"source" text DEFAULT 'website',
	"is_subscribed" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"promotion_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "premium_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_features_feature_key_unique" UNIQUE("feature_key")
);
--> statement-breakpoint
CREATE TABLE "pricing_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_type" text NOT NULL,
	"radius_km" integer NOT NULL,
	"period" text,
	"price_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promoted_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"image_url" text,
	"link_url" text,
	"target_radius" integer,
	"target_city" text,
	"target_all_users" boolean DEFAULT false,
	"campaign_name" text,
	"advertiser_name" text,
	"advertiser_email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"budget_cents" integer DEFAULT 0,
	"cpm_cents" integer DEFAULT 0,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quality_check_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"quality_check_id" integer NOT NULL,
	"event_id" integer,
	"feed_item_id" integer,
	"issue_type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"field" text,
	"message" text NOT NULL,
	"source_value" text,
	"imported_value" text,
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feed_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"link" text,
	"image_url" text,
	"published_at" timestamp,
	"raw_data" jsonb,
	"event_id" integer,
	"is_processed" boolean DEFAULT false,
	"processing_status" text DEFAULT 'incomplete',
	"missing_fields" jsonb,
	"derived_data" jsonb,
	"last_attempted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"feed_type" text DEFAULT 'rss' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"default_category" text NOT NULL,
	"default_latitude" numeric,
	"default_longitude" numeric,
	"default_address" text,
	"municipality" text,
	"province" text,
	"update_frequency_minutes" integer DEFAULT 60 NOT NULL,
	"last_fetched_at" timestamp,
	"last_error_message" text,
	"items_imported" integer DEFAULT 0,
	"auto_create_events" boolean DEFAULT true,
	"ai_extraction_profile_id" integer,
	"scraper_config" jsonb,
	"field_mappings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_item_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer,
	"field_key" text NOT NULL,
	"original_value_pattern" text NOT NULL,
	"corrected_value" jsonb NOT NULL,
	"applied_count" integer DEFAULT 0,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"push_enabled" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "seasonal_themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text NOT NULL,
	"keywords" text[] NOT NULL,
	"start_month" integer,
	"start_day" integer,
	"end_month" integer,
	"end_day" integer,
	"is_floating" boolean DEFAULT false,
	"floating_rule" text,
	"is_school_holiday" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seasonal_themes_name_unique" UNIQUE("name"),
	CONSTRAINT "seasonal_themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sponsor_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer,
	"event_id" integer,
	"created_by_user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sponsor_name" text,
	"sponsor_contact" text,
	"sponsor_email" text,
	"sponsor_phone" text,
	"campaign_type" text DEFAULT 'visibility',
	"value" integer,
	"currency" text DEFAULT 'EUR',
	"start_date" timestamp,
	"end_date" timestamp,
	"status" text DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "target_audiences" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text NOT NULL,
	"keywords" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "target_audiences_name_unique" UNIQUE("name"),
	CONSTRAINT "target_audiences_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"avatar" text,
	"photo_url" text,
	"google_id" text,
	"role" text DEFAULT 'user' NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"name" text,
	"phone" text,
	"user_location" text,
	"bio" text,
	"preferences" jsonb,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" text,
	"email_verification_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "venue_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venue_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venue_organizers" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp,
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'todo',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"municipality" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"latitude" numeric,
	"longitude" numeric,
	"source_url" text,
	"usage_count" integer DEFAULT 1,
	"last_used_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"slug" text,
	"description" text,
	"contact_email" text,
	"contact_phone" text,
	"website_url" text,
	"image_url" text,
	"category" text,
	"is_verified" boolean DEFAULT false,
	"claimed_by_user_id" integer,
	"claimed_at" timestamp,
	"status" text DEFAULT 'active',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_ad_id_business_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."business_ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advertiser_profiles" ADD CONSTRAINT "advertiser_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_ads" ADD CONSTRAINT "business_ads_advertiser_id_advertiser_profiles_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertiser_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_audience_mappings" ADD CONSTRAINT "event_audience_mappings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_audience_mappings" ADD CONSTRAINT "event_audience_mappings_audience_id_target_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."target_audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_promotions" ADD CONSTRAINT "event_promotions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_promotions" ADD CONSTRAINT "event_promotions_purchased_by_user_id_users_id_fk" FOREIGN KEY ("purchased_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tag_mappings" ADD CONSTRAINT "event_tag_mappings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tag_mappings" ADD CONSTRAINT "event_tag_mappings_tag_id_event_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."event_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_theme_mappings" ADD CONSTRAINT "event_theme_mappings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_theme_mappings" ADD CONSTRAINT "event_theme_mappings_theme_id_seasonal_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."seasonal_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_analysis_profiles" ADD CONSTRAINT "feed_analysis_profiles_analyzed_by_users_id_fk" FOREIGN KEY ("analyzed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_quality_checks" ADD CONSTRAINT "feed_quality_checks_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_sync_history" ADD CONSTRAINT "feed_sync_history_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_promotion_id_promoted_notifications_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promoted_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_notifications" ADD CONSTRAINT "promoted_notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_notifications" ADD CONSTRAINT "promoted_notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_check_issues" ADD CONSTRAINT "quality_check_issues_quality_check_id_feed_quality_checks_id_fk" FOREIGN KEY ("quality_check_id") REFERENCES "public"."feed_quality_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_check_issues" ADD CONSTRAINT "quality_check_issues_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_check_issues" ADD CONSTRAINT "quality_check_issues_feed_item_id_rss_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."rss_feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_feed_items" ADD CONSTRAINT "rss_feed_items_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_feed_items" ADD CONSTRAINT "rss_feed_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_item_corrections" ADD CONSTRAINT "rss_item_corrections_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_item_corrections" ADD CONSTRAINT "rss_item_corrections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_campaigns" ADD CONSTRAINT "sponsor_campaigns_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_campaigns" ADD CONSTRAINT "sponsor_campaigns_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_campaigns" ADD CONSTRAINT "sponsor_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_contacts" ADD CONSTRAINT "venue_contacts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_notes" ADD CONSTRAINT "venue_notes_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_notes" ADD CONSTRAINT "venue_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_organizers" ADD CONSTRAINT "venue_organizers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_organizers" ADD CONSTRAINT "venue_organizers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_organizers" ADD CONSTRAINT "venue_organizers_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_tasks" ADD CONSTRAINT "venue_tasks_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_tasks" ADD CONSTRAINT "venue_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_tasks" ADD CONSTRAINT "venue_tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;