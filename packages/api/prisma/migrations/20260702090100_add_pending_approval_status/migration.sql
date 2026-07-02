-- AlterEnum
-- (isolada: novos valores de enum precisam ser commitados antes de serem usados)
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_APPROVAL' BEFORE 'OPEN';
