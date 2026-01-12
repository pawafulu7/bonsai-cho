import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * OAuth Accounts - Links OAuth providers to users
 *
 * Constraints:
 * - UNIQUE(provider, providerAccountId): One OAuth account per provider
 * - UNIQUE(userId, provider): One account per provider per user
 */
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "github" | "google"
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email"),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(
      false
    ),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("uq_oauth_provider_account").on(
      table.provider,
      table.providerAccountId
    ),
    uniqueIndex("uq_oauth_user_provider").on(table.userId, table.provider),
    index("idx_oauth_user").on(table.userId),
  ]
);

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

/**
 * OAuth States - Temporary storage for OAuth flow state
 *
 * Security:
 * - state is the primary key (unique identifier)
 * - codeVerifier is encrypted with AES-GCM
 * - expiresAt enforces 10-minute TTL
 * - Records should be deleted after single use
 */
export const oauthStates = sqliteTable(
  "oauth_states",
  {
    id: text("id").primaryKey(), // state value itself (unique)
    codeVerifier: text("code_verifier").notNull(), // AES-GCM encrypted
    provider: text("provider").notNull(), // "github" | "google"
    returnTo: text("return_to"), // Optional redirect after login
    nonce: text("nonce"), // For Google OIDC id_token verification
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_oauth_states_expires").on(table.expiresAt)]
);

// Type exports for use in application code
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;
