DROP INDEX `idx_user_status_history_user_id`;--> statement-breakpoint
CREATE INDEX `idx_user_status_history_user_changed` ON `user_status_history` (`user_id`,`changed_at`,`id`);