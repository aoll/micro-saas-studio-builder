-- The skeleton's `demo` row has no theme, config or owner: the full data
-- model (0002) adds several NOT NULL columns to `products` with no
-- default. Nothing references `products` yet (CONTRACT-data is the first
-- spec to add FKs onto it), so clearing the table here is safe on every
-- worktree database.
DELETE FROM "products";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "name";