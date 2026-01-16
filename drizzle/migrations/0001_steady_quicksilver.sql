CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bonsai_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bonsai_id`) REFERENCES `bonsai`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_bonsai` ON `comments` (`bonsai_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_user` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_bonsai_created` ON `comments` (`bonsai_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_follows` ON `follows` (`follower_id`,`following_id`);--> statement-breakpoint
CREATE INDEX `idx_follows_follower` ON `follows` (`follower_id`);--> statement-breakpoint
CREATE INDEX `idx_follows_following` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `likes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bonsai_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bonsai_id`) REFERENCES `bonsai`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_likes_user_bonsai` ON `likes` (`user_id`,`bonsai_id`);--> statement-breakpoint
CREATE INDEX `idx_likes_bonsai` ON `likes` (`bonsai_id`);--> statement-breakpoint
CREATE INDEX `idx_likes_user` ON `likes` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `follower_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `following_count` integer DEFAULT 0 NOT NULL;