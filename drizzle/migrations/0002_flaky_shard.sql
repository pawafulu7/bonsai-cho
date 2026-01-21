CREATE TABLE `user_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`previous_status` text NOT NULL,
	`new_status` text NOT NULL,
	`reason` text,
	`changed_by` text,
	`changed_at` text DEFAULT (datetime('now')) NOT NULL,
	`ip_address` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_user_status_history_user_id` ON `user_status_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_status_history_changed_at` ON `user_status_history` (`changed_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `status_changed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `status_changed_by` text;--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_follows_no_self_follow" CHECK("__new_follows"."follower_id" <> "__new_follows"."following_id")
);
--> statement-breakpoint
INSERT INTO `__new_follows`("id", "follower_id", "following_id", "created_at")
SELECT "id", "follower_id", "following_id", "created_at"
FROM `follows`
WHERE "follower_id" <> "following_id";--> statement-breakpoint
DROP TABLE `follows`;--> statement-breakpoint
ALTER TABLE `__new_follows` RENAME TO `follows`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_follows` ON `follows` (`follower_id`,`following_id`);--> statement-breakpoint
CREATE INDEX `idx_follows_follower` ON `follows` (`follower_id`);--> statement-breakpoint
CREATE INDEX `idx_follows_following` ON `follows` (`following_id`);