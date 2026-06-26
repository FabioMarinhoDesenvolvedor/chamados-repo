-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_activity_by" TEXT,
ALTER COLUMN "complexity" DROP NOT NULL,
ALTER COLUMN "priority" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'TRIAGE';

-- CreateTable
CREATE TABLE "ticket_read_state" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_read_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_read_state_user_id_idx" ON "ticket_read_state"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_read_state_user_id_ticket_id_key" ON "ticket_read_state"("user_id", "ticket_id");

-- AddForeignKey
ALTER TABLE "ticket_read_state" ADD CONSTRAINT "ticket_read_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_read_state" ADD CONSTRAINT "ticket_read_state_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
