ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "device_limit_override_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "device_limit_max" integer;

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "device_id" text NOT NULL,
  "device_label" text,
  "platform" text,
  "user_agent" text,
  "ip_address" text,
  "refresh_token_hash" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "revoked_by" varchar REFERENCES "users"("id") ON DELETE set null,
  "revoke_reason" text
);

CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_active"
  ON "user_sessions" ("user_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_device"
  ON "user_sessions" ("user_id", "device_id");
