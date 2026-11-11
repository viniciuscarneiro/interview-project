CREATE TABLE "bids" (
 "id" UUID NOT NULL,
 "auction_id" UUID NOT NULL,
 "buyer_id" UUID NOT NULL,
 "amount" BIGINT NOT NULL,
 "accepted_at" TIMESTAMPTZ(3) NOT NULL,
 "acceptance_order" BIGINT NOT NULL,
 CONSTRAINT "bids_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "bids_amount" CHECK ("amount" BETWEEN 1 AND 9007199254740991),
 CONSTRAINT "bids_positive_acceptance_order" CHECK ("acceptance_order" > 0),
 CONSTRAINT "bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "bids_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bids_auction_acceptance_order_key" ON "bids"("auction_id", "acceptance_order");
CREATE INDEX "bids_highest_order" ON "bids"("auction_id", "amount" DESC, "acceptance_order" ASC);
