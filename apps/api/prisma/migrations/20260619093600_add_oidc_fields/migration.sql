-- AlterTable
ALTER TABLE "User" ADD COLUMN "oidcProvider" TEXT,
ADD COLUMN "oidcId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcProvider_oidcId_key" ON "User"("oidcProvider", "oidcId");
