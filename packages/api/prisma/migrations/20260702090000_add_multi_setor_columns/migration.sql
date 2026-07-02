-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "is_requester_dept" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_executor_dept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notification_email" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_kiosk" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ticket_categories" ADD COLUMN     "department_id" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "executor_department_id" TEXT,
ADD COLUMN     "origin_location" TEXT;

-- CreateIndex
CREATE INDEX "ticket_categories_department_id_idx" ON "ticket_categories"("department_id");

-- CreateIndex
CREATE INDEX "tickets_executor_department_id_idx" ON "tickets"("executor_department_id");

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_executor_department_id_fkey" FOREIGN KEY ("executor_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
