CREATE TYPE "public"."credit_reason" AS ENUM('signup_bonus', 'purchase', 'generation', 'refund');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('visit', 'first_generation', 'signup', 'generation', 'credits_exhausted', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."landing_variant" AS ENUM('centered', 'split', 'minimal');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('test', 'learn', 'scale', 'killed');--> statement-breakpoint
CREATE TABLE "balances" (
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balances_user_id_product_id_pk" PRIMARY KEY("user_id","product_id"),
	CONSTRAINT "balances_balance_nonnegative" CHECK ("balances"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"generation_id" uuid,
	"purchase_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "credit_transactions_delta_nonzero" CHECK ("credit_transactions"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "decision_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"min_visits" integer,
	"kill_max_conversion" numeric(5, 4),
	"scale_min_conversion" numeric(5, 4),
	"scale_requires_positive_margin" boolean,
	"is_seed" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decision_thresholds_product_id_key" UNIQUE NULLS NOT DISTINCT("product_id"),
	CONSTRAINT "decision_thresholds_min_visits_positive" CHECK ("decision_thresholds"."min_visits" IS NULL OR "decision_thresholds"."min_visits" > 0),
	CONSTRAINT "decision_thresholds_kill_max_conversion_range" CHECK ("decision_thresholds"."kill_max_conversion" IS NULL OR ("decision_thresholds"."kill_max_conversion" >= 0 AND "decision_thresholds"."kill_max_conversion" <= 1)),
	CONSTRAINT "decision_thresholds_scale_min_conversion_range" CHECK ("decision_thresholds"."scale_min_conversion" IS NULL OR ("decision_thresholds"."scale_min_conversion" >= 0 AND "decision_thresholds"."scale_min_conversion" <= 1)),
	CONSTRAINT "decision_thresholds_kill_lt_scale" CHECK ("decision_thresholds"."kill_max_conversion" IS NULL OR "decision_thresholds"."scale_min_conversion" IS NULL OR "decision_thresholds"."kill_max_conversion" < "decision_thresholds"."scale_min_conversion"),
	CONSTRAINT "decision_thresholds_default_row_complete" CHECK ("decision_thresholds"."product_id" IS NOT NULL OR (
        "decision_thresholds"."min_visits" IS NOT NULL AND
        "decision_thresholds"."kill_max_conversion" IS NOT NULL AND
        "decision_thresholds"."scale_min_conversion" IS NOT NULL AND
        "decision_thresholds"."scale_requires_positive_margin" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" uuid NOT NULL,
	"type" "event_type" NOT NULL,
	"user_id" text,
	"anonymous_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"product_version" integer NOT NULL,
	"user_id" text,
	"anonymous_id" text,
	"ip_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_input_tokens" integer,
	"cost_micros" integer,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generations_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "product_versions" (
	"product_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_versions_product_id_version_pk" PRIMARY KEY("product_id","version"),
	CONSTRAINT "product_versions_version_positive" CHECK ("product_versions"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"pack_id" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "purchases_credits_positive" CHECK ("purchases"."credits" > 0),
	CONSTRAINT "purchases_amount_cents_positive" CHECK ("purchases"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tokens" jsonb NOT NULL,
	"landing_variant" "landing_variant" NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" "product_status" DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "theme_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "current_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "locale" text NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_seed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_by" text NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status_note" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_thresholds" ADD CONSTRAINT "decision_thresholds_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_thresholds" ADD CONSTRAINT "decision_thresholds_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_product_version_fk" FOREIGN KEY ("product_id","product_version") REFERENCES "public"."product_versions"("product_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_transactions_user_id_product_id_created_at_idx" ON "credit_transactions" USING btree ("user_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "events_product_id_type_created_at_idx" ON "events" USING btree ("product_id","type","created_at");--> statement-breakpoint
CREATE INDEX "generations_user_id_created_at_idx" ON "generations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generations_ip_hash_created_at_idx" ON "generations" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "generations_product_id_created_at_idx" ON "generations" USING btree ("product_id","created_at");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_slug_format" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_current_version_positive" CHECK ("products"."current_version" >= 1);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_locale_valid" CHECK ("products"."locale" IN ('fr', 'en'));