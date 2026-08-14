CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booked_at` integer DEFAULT (unixepoch()) NOT NULL,
	`booked_by` text,
	`type` text NOT NULL,
	`source` text,
	`article_id` integer,
	`article_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`location_id` integer,
	`from_location_id` integer,
	`best_before` text,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `storage_locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_location_id`) REFERENCES `storage_locations`(`id`) ON UPDATE no action ON DELETE no action
);
