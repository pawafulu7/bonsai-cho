import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";
import { users } from "./users";
import { species, styles } from "./masters";

// Bonsai
export const bonsai = sqliteTable(
  "bonsai",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    speciesId: text("species_id").references(() => species.id, {
      onDelete: "set null",
    }),
    styleId: text("style_id").references(() => styles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    acquiredAt: text("acquired_at"),
    estimatedAge: integer("estimated_age"),
    height: real("height"),
    width: real("width"),
    potDetails: text("pot_details"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_bonsai_user").on(table.userId),
    index("idx_bonsai_species").on(table.speciesId),
    index("idx_bonsai_style").on(table.styleId),
    index("idx_bonsai_public_created").on(table.isPublic, table.createdAt),
    index("idx_bonsai_created_at").on(table.createdAt),
  ]
);

export const bonsaiRelations = relations(bonsai, ({ one, many }) => ({
  user: one(users, {
    fields: [bonsai.userId],
    references: [users.id],
  }),
  species: one(species, {
    fields: [bonsai.speciesId],
    references: [species.id],
  }),
  style: one(styles, {
    fields: [bonsai.styleId],
    references: [styles.id],
  }),
  images: many(bonsaiImages),
  careLogs: many(careLogs),
  tags: many(bonsaiTags),
}));

// Bonsai Images
export const bonsaiImages = sqliteTable(
  "bonsai_images",
  {
    id: text("id").primaryKey(),
    bonsaiId: text("bonsai_id")
      .notNull()
      .references(() => bonsai.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    caption: text("caption"),
    takenAt: text("taken_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_bonsai_images_bonsai").on(table.bonsaiId),
    index("idx_bonsai_images_sort").on(table.bonsaiId, table.sortOrder),
  ]
);

export const bonsaiImagesRelations = relations(bonsaiImages, ({ one }) => ({
  bonsai: one(bonsai, {
    fields: [bonsaiImages.bonsaiId],
    references: [bonsai.id],
  }),
}));

// Care Logs
export const careLogs = sqliteTable(
  "care_logs",
  {
    id: text("id").primaryKey(),
    bonsaiId: text("bonsai_id")
      .notNull()
      .references(() => bonsai.id, { onDelete: "cascade" }),
    careType: text("care_type", {
      enum: [
        "watering",
        "fertilizing",
        "pruning",
        "repotting",
        "wiring",
        "other",
      ],
    }).notNull(),
    description: text("description"),
    performedAt: text("performed_at").notNull(),
    imageUrl: text("image_url"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_care_logs_bonsai").on(table.bonsaiId),
    index("idx_care_logs_type").on(table.bonsaiId, table.careType),
    index("idx_care_logs_performed").on(table.bonsaiId, table.performedAt),
  ]
);

export const careLogsRelations = relations(careLogs, ({ one }) => ({
  bonsai: one(bonsai, {
    fields: [careLogs.bonsaiId],
    references: [bonsai.id],
  }),
}));

// Tags
export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_tags_name").on(table.name),
    index("idx_tags_usage").on(table.usageCount),
  ]
);

export const tagsRelations = relations(tags, ({ many }) => ({
  bonsaiTags: many(bonsaiTags),
}));

// Bonsai Tags (junction table)
export const bonsaiTags = sqliteTable(
  "bonsai_tags",
  {
    id: text("id").primaryKey(),
    bonsaiId: text("bonsai_id")
      .notNull()
      .references(() => bonsai.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_bonsai_tags_bonsai").on(table.bonsaiId),
    index("idx_bonsai_tags_tag").on(table.tagId),
  ]
);

export const bonsaiTagsRelations = relations(bonsaiTags, ({ one }) => ({
  bonsai: one(bonsai, {
    fields: [bonsaiTags.bonsaiId],
    references: [bonsai.id],
  }),
  tag: one(tags, {
    fields: [bonsaiTags.tagId],
    references: [tags.id],
  }),
}));
