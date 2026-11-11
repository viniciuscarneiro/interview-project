ALTER TYPE "AuctionStatus" ADD VALUE 'ACTIVE';
ALTER TABLE "auctions" ADD COLUMN "activated_at" TIMESTAMPTZ(3);
-- Compare enum text so the constraint does not require using the newly added
-- enum literal before this migration has committed.
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_activation_state" CHECK (
  ("status"::text = 'DRAFT' AND "activated_at" IS NULL) OR
  ("status"::text = 'ACTIVE' AND "activated_at" IS NOT NULL
    AND "activated_at" >= "created_at" AND "activated_at" < "end_time")
);
