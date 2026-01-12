import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Species (tree species)
export const species = sqliteTable(
  "species",
  {
    id: text("id").primaryKey(),
    nameJa: text("name_ja").notNull().unique(),
    nameEn: text("name_en"),
    nameScientific: text("name_scientific"),
    description: text("description"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_species_name_en").on(table.nameEn),
  ]
);

// Styles (bonsai styles)
export const styles = sqliteTable(
  "styles",
  {
    id: text("id").primaryKey(),
    nameJa: text("name_ja").notNull().unique(),
    nameEn: text("name_en"),
    description: text("description"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => []
);
