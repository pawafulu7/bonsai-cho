CREATE TABLE `bonsai` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`species_id` text,
	`style_id` text,
	`name` text NOT NULL,
	`description` text,
	`acquired_at` text,
	`estimated_age` integer,
	`height` real,
	`width` real,
	`pot_details` text,
	`is_public` integer DEFAULT true NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bonsai_user` ON `bonsai` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bonsai_species` ON `bonsai` (`species_id`);--> statement-breakpoint
CREATE INDEX `idx_bonsai_style` ON `bonsai` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_bonsai_public_created` ON `bonsai` (`is_public`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bonsai_created_at` ON `bonsai` (`created_at`);--> statement-breakpoint
CREATE TABLE `bonsai_images` (
	`id` text PRIMARY KEY NOT NULL,
	`bonsai_id` text NOT NULL,
	`image_url` text NOT NULL,
	`thumbnail_url` text,
	`caption` text,
	`taken_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bonsai_id`) REFERENCES `bonsai`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bonsai_images_bonsai` ON `bonsai_images` (`bonsai_id`);--> statement-breakpoint
CREATE INDEX `idx_bonsai_images_sort` ON `bonsai_images` (`bonsai_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `bonsai_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`bonsai_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bonsai_id`) REFERENCES `bonsai`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bonsai_tags_bonsai` ON `bonsai_tags` (`bonsai_id`);--> statement-breakpoint
CREATE INDEX `idx_bonsai_tags_tag` ON `bonsai_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bonsai_tags` ON `bonsai_tags` (`bonsai_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `care_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`bonsai_id` text NOT NULL,
	`care_type` text NOT NULL,
	`description` text,
	`performed_at` text NOT NULL,
	`image_url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bonsai_id`) REFERENCES `bonsai`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_care_logs_bonsai` ON `care_logs` (`bonsai_id`);--> statement-breakpoint
CREATE INDEX `idx_care_logs_type` ON `care_logs` (`bonsai_id`,`care_type`);--> statement-breakpoint
CREATE INDEX `idx_care_logs_performed` ON `care_logs` (`bonsai_id`,`performed_at`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_oauth_provider_account` ON `oauth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_oauth_user_provider` ON `oauth_accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `idx_oauth_user` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`id` text PRIMARY KEY NOT NULL,
	`code_verifier` text NOT NULL,
	`provider` text NOT NULL,
	`return_to` text,
	`nonce` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_states_expires` ON `oauth_states` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `species` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ja` text NOT NULL,
	`name_en` text,
	`name_scientific` text,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `species_name_ja_unique` ON `species` (`name_ja`);--> statement-breakpoint
CREATE INDEX `idx_species_name_en` ON `species` (`name_en`);--> statement-breakpoint
CREATE TABLE `styles` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ja` text NOT NULL,
	`name_en` text,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `styles_name_ja_unique` ON `styles` (`name_ja`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `idx_tags_usage` ON `tags` (`usage_count`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`bio` text,
	`location` text,
	`website` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_name` ON `users` (`name`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_deleted_at` ON `users` (`deleted_at`);