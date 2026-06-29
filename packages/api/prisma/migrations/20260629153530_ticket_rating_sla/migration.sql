-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "sla_started_at" TIMESTAMP(3);
