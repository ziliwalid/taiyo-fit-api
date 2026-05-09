-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COACH';

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "utilisateurId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Coach_utilisateurId_key" ON "Coach"("utilisateurId");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
