ALTER TABLE `articles` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `origin` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `organic` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `nutrition` text;