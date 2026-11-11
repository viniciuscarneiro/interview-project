CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservation_cancellation_state" CHECK (
      ("status" = 'ACTIVE' AND "cancelled_at" IS NULL) OR
      ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "reservations_one_active_per_vehicle"
ON "reservations" ("vehicle_id") WHERE "status" = 'ACTIVE';
