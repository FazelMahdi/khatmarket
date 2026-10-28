-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "number" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'MCI',
    "price" BIGINT,
    "status" TEXT,
    "patternTags" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'import',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lookup" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "number" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_code_key" ON "Listing"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_number_key" ON "Listing"("number");

-- CreateIndex
CREATE INDEX "Listing_prefix_idx" ON "Listing"("prefix");

-- CreateIndex
CREATE INDEX "Lookup_userId_createdAt_idx" ON "Lookup"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lookup" ADD CONSTRAINT "Lookup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
