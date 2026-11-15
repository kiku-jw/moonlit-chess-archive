CREATE TABLE `chess_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`white_hash` text NOT NULL,
	`black_hash` text,
	`moves` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`result` text,
	`reason` text,
	`draw_offer` text,
	`requests` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chess_rooms_expiry` ON `chess_rooms` (`expires_at`);