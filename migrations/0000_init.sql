CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `rateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`lastRequest` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rateLimit_key_unique` ON `rateLimit` (`key`);--> statement-breakpoint
CREATE TABLE `serverBudget` (
	`server` text PRIMARY KEY NOT NULL,
	`emailPerDay` integer NOT NULL,
	`socialPerDay` integer NOT NULL,
	`note` text,
	`approvedBy` text NOT NULL,
	`approvedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `serverConsent` (
	`emailHash` text NOT NULL,
	`server` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`emailHash`, `server`)
);
--> statement-breakpoint
CREATE TABLE `serverSession` (
	`id` text PRIMARY KEY NOT NULL,
	`server` text NOT NULL,
	`resource` text NOT NULL,
	`clientId` text NOT NULL,
	`scope` text NOT NULL,
	`emailHash` text NOT NULL,
	`userInfoEncrypted` text NOT NULL,
	`authTime` integer NOT NULL,
	`codeChallenge` text NOT NULL,
	`codeSecretHash` text NOT NULL,
	`codeExpires` integer,
	`redirectUri` text NOT NULL,
	`nonce` text,
	`refreshTokenHash` text NOT NULL,
	`refreshPreviousHash` text,
	`rotatedAt` integer,
	`refreshNextEncrypted` text,
	`createdOn` text NOT NULL,
	`createdAt` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `serverSession_emailHash_idx` ON `serverSession` (`emailHash`);--> statement-breakpoint
CREATE INDEX `serverSession_expires_idx` ON `serverSession` (`expires`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `signingKey` (
	`kid` text PRIMARY KEY NOT NULL,
	`period` integer NOT NULL,
	`alg` text NOT NULL,
	`publicJwk` text NOT NULL,
	`privateKeyEncrypted` text NOT NULL,
	`createdAt` integer NOT NULL,
	`activatesAt` integer NOT NULL,
	`retiresAt` integer NOT NULL,
	`removesAt` integer NOT NULL,
	`revokedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signingKey_period_active` ON `signingKey` (`period`) WHERE revokedAt IS NULL;--> statement-breakpoint
CREATE TABLE `usageCounter` (
	`bucket` text NOT NULL,
	`day` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`bucket`, `day`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);