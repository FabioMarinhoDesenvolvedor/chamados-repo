-- AlterEnum
-- (isolada: novos valores de enum precisam ser commitados antes de serem usados como default;
-- OPERATOR nao e usado como DEFAULT, entao uma unica migration e suficiente)
ALTER TYPE "Role" ADD VALUE 'OPERATOR';
