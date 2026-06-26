-- AlterEnum
-- (isolada: novos valores de enum precisam ser commitados antes de serem usados como default)
ALTER TYPE "TicketStatus" ADD VALUE 'TRIAGE' BEFORE 'OPEN';
