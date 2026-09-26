CREATE TYPE "public"."invoice_job_status" AS ENUM('queued', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "invoice_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"month" text NOT NULL,
	"status" "invoice_job_status" DEFAULT 'queued' NOT NULL,
	"blob_url" text,
	"error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "invoice_jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "invoice_jobs_month_format" CHECK ("invoice_jobs"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "invoice_jobs" ADD CONSTRAINT "invoice_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_jobs" ADD CONSTRAINT "invoice_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_jobs_user_product_status_idx" ON "invoice_jobs" USING btree ("user_id","product_id","status");