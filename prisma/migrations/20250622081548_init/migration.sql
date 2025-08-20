-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "deleteFlg" TEXT NOT NULL DEFAULT '0';

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "deleteFlg" SET DEFAULT '0';

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "deleteFlg" TEXT NOT NULL DEFAULT '0';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "deleteFlg" TEXT NOT NULL DEFAULT '0';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "deleteFlg" TEXT NOT NULL DEFAULT '0';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deleted_at" TIMESTAMP(3);
