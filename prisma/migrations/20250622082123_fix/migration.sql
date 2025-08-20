/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "deleted_at",
ADD COLUMN     "deleteFlg" TEXT NOT NULL DEFAULT '0';
