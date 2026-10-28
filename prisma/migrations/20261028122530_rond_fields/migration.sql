-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "algorithms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priceType" TEXT,
ADD COLUMN     "sellType" TEXT,
ADD COLUMN     "special" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
