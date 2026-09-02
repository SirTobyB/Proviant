CREATE TABLE `picnic_prices` (
	`picnic_id` text PRIMARY KEY NOT NULL,
	`regular_price` integer NOT NULL,
	`promo_price` integer,
	`promo_label` text,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
