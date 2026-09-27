ALTER TABLE "products" DROP CONSTRAINT "products_current_version_positive";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "current_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_current_version_positive" CHECK ("products"."current_version" IS NULL OR "products"."current_version" >= 1);