CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BASIC');
CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_canonical" CHECK ("email" = lower(btrim("email")))
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
