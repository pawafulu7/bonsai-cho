CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_ip` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`details` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_target` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_system_settings_updated_at` ON `system_settings` (`updated_at`);