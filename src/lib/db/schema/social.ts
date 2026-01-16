import { relations, sql } from "drizzle-orm";
import {
	index,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { bonsai } from "./bonsai";
import { users } from "./users";

// Likes - User likes on Bonsai posts
export const likes = sqliteTable(
	"likes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		bonsaiId: text("bonsai_id")
			.notNull()
			.references(() => bonsai.id, { onDelete: "cascade" }),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	},
	(table) => [
		uniqueIndex("uq_likes_user_bonsai").on(table.userId, table.bonsaiId),
		index("idx_likes_bonsai").on(table.bonsaiId),
		index("idx_likes_user").on(table.userId),
	]
);

export const likesRelations = relations(likes, ({ one }) => ({
	user: one(users, {
		fields: [likes.userId],
		references: [users.id],
	}),
	bonsai: one(bonsai, {
		fields: [likes.bonsaiId],
		references: [bonsai.id],
	}),
}));

// Comments - User comments on Bonsai posts
export const comments = sqliteTable(
	"comments",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		bonsaiId: text("bonsai_id")
			.notNull()
			.references(() => bonsai.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
		updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
		deletedAt: text("deleted_at"),
	},
	(table) => [
		index("idx_comments_bonsai").on(table.bonsaiId),
		index("idx_comments_user").on(table.userId),
		index("idx_comments_bonsai_created").on(table.bonsaiId, table.createdAt),
	]
);

export const commentsRelations = relations(comments, ({ one }) => ({
	user: one(users, {
		fields: [comments.userId],
		references: [users.id],
	}),
	bonsai: one(bonsai, {
		fields: [comments.bonsaiId],
		references: [bonsai.id],
	}),
}));

// Follows - User following relationships
// Note: CHECK constraint (follower_id <> following_id) is added in migration SQL
export const follows = sqliteTable(
	"follows",
	{
		id: text("id").primaryKey(),
		followerId: text("follower_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		followingId: text("following_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	},
	(table) => [
		uniqueIndex("uq_follows").on(table.followerId, table.followingId),
		index("idx_follows_follower").on(table.followerId),
		index("idx_follows_following").on(table.followingId),
	]
);

export const followsRelations = relations(follows, ({ one }) => ({
	follower: one(users, {
		fields: [follows.followerId],
		references: [users.id],
		relationName: "follower",
	}),
	following: one(users, {
		fields: [follows.followingId],
		references: [users.id],
		relationName: "following",
	}),
}));
