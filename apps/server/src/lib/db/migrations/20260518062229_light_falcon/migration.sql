ALTER TABLE `projects` ADD `created_at_ms` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `total_size_bytes` integer DEFAULT 0 NOT NULL;
