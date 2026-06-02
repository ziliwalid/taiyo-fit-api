-- CreateEnum
CREATE TYPE "GenreCours" AS ENUM ('BOOTCAMP', 'HIIT', 'YOGA', 'PILATES', 'TRAINING');

-- AlterTable
ALTER TABLE "Cours" ADD COLUMN "genre" "GenreCours";
