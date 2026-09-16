ALTER TABLE "items" ADD COLUMN "recipe_uom" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "portions_per_container" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "in_use_remaining_portions" numeric(12, 3) DEFAULT '0.000' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "recipe_uom" text;