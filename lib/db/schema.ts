// Business tables (docs/07-modele-de-donnees.md). This spec only needs the
// minimal `products` table the walking skeleton reads; the full catalogue
// and usage tables arrive with CONTRACT-data.
//
// No `import "server-only"` here: drizzle-kit and tsx (scripts/seed.ts,
// drizzle.config.ts) import this module directly, outside a request.
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});
