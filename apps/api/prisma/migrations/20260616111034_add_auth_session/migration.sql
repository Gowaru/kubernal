/*
  Warnings:

  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Session` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Session_sid_idx";

-- DropIndex
DROP INDEX "Session_sid_key";

-- AlterTable
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey",
DROP COLUMN "id",
ALTER COLUMN "expiresAt" DROP NOT NULL,
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("sid");
