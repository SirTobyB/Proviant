CREATE TABLE `recipe_ingredient_articles` (
	`recipe_ingredient_id` integer NOT NULL,
	`article_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	PRIMARY KEY(`recipe_ingredient_id`, `article_id`),
	FOREIGN KEY (`recipe_ingredient_id`) REFERENCES `recipe_ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `recipe_ingredient_articles` (`recipe_ingredient_id`, `article_id`, `sort_order`, `created_at`, `created_by`) SELECT `id`, `article_id`, 0, `created_at`, `created_by` FROM `recipe_ingredients` WHERE `article_id` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`free_text` text,
	`amount` real,
	`unit` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recipe_ingredients`("id", "recipe_id", "free_text", "amount", "unit", "sort_order", "created_at", "created_by", "updated_at", "updated_by") SELECT "id", "recipe_id", "free_text", "amount", "unit", "sort_order", "created_at", "created_by", "updated_at", "updated_by" FROM `recipe_ingredients`;--> statement-breakpoint
DROP TABLE `recipe_ingredients`;--> statement-breakpoint
ALTER TABLE `__new_recipe_ingredients` RENAME TO `recipe_ingredients`;--> statement-breakpoint
PRAGMA foreign_keys=ON;