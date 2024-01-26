CREATE TABLE `amcatSession` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`expires` integer NOT NULL,
	`secret` text,
	`secretExpires` integer,
	`codeChallenge` text,
	`createdOn` text NOT NULL,
	`createdAt` integer NOT NULL,
	`clientId` text NOT NULL,
	`resource` text NOT NULL,
	`scope` text NOT NULL,
	`refreshToken` text NOT NULL,
	`refreshRotate` integer NOT NULL,
	`refreshPrevious` text
);
--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE INDEX `email_idx` ON `amcatSession` (`email`);--> statement-breakpoint
CREATE INDEX `expires_idx` ON `amcatSession` (`expires`);