CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT');
CREATE TABLE "auctions" (
 "id" UUID NOT NULL,
 "brand" VARCHAR(100) NOT NULL,
 "model" VARCHAR(100) NOT NULL,
 "vin" VARCHAR(17) NOT NULL,
 "starting_price" BIGINT NOT NULL,
 "currency" VARCHAR(3) NOT NULL,
 "status" "AuctionStatus" NOT NULL,
 "end_time" TIMESTAMPTZ(3) NOT NULL,
 "created_at" TIMESTAMPTZ(3) NOT NULL,
 "created_by" UUID NOT NULL,
 CONSTRAINT "auctions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "auctions_starting_price" CHECK ("starting_price" BETWEEN 1 AND 9007199254740991),
 CONSTRAINT "auctions_currency" CHECK ("currency" = 'EUR'),
 CONSTRAINT "auctions_end_after_creation" CHECK ("end_time" > "created_at"),
 CONSTRAINT "auctions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "auctions_listing_order" ON "auctions"("created_at" DESC, "id" ASC);
