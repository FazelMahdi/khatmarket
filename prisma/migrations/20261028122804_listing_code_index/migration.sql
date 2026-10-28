-- DropIndex
DROP INDEX "Listing_code_key";

-- CreateIndex
CREATE INDEX "Listing_code_idx" ON "Listing"("code");
