CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`username`) REFERENCES `users`(`username`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`username` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
ALTER TABLE `articles` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `updated_by` text;--> statement-breakpoint
-- SQLite erlaubt bei ADD COLUMN nur konstante Defaults; daher DEFAULT 0 + Backfill.
ALTER TABLE `recipe_ingredients` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `recipe_ingredients` SET `created_at` = (unixepoch()) WHERE `created_at` = 0;--> statement-breakpoint
ALTER TABLE `recipe_ingredients` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `recipe_ingredients` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `recipe_ingredients` SET `updated_at` = (unixepoch()) WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `recipe_ingredients` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `recipe_tags` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `recipe_tags` SET `created_at` = (unixepoch()) WHERE `created_at` = 0;--> statement-breakpoint
ALTER TABLE `recipe_tags` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `stock_entries` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `stock_entries` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `stock_entries` SET `updated_at` = `created_at` WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `stock_entries` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `storage_locations` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `storage_locations` SET `created_at` = (unixepoch()) WHERE `created_at` = 0;--> statement-breakpoint
ALTER TABLE `storage_locations` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `storage_locations` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `storage_locations` SET `updated_at` = (unixepoch()) WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `storage_locations` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `tags` SET `created_at` = (unixepoch()) WHERE `created_at` = 0;--> statement-breakpoint
ALTER TABLE `tags` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `tags` SET `updated_at` = (unixepoch()) WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_by` text;
