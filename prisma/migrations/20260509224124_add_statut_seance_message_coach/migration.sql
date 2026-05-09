-- CreateEnum
CREATE TYPE "StatutSeance" AS ENUM ('PLANIFIE', 'EN_RETARD', 'LIEU_MODIFIE', 'ANNULE');

-- AlterTable
ALTER TABLE "Cours" ADD COLUMN     "messageCoach" TEXT,
ADD COLUMN     "statutSeance" "StatutSeance" NOT NULL DEFAULT 'PLANIFIE';
