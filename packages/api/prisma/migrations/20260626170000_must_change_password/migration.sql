-- AlterTable: novo campo com default true (novos usuários trocam no 1º acesso)
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- Usuários já existentes não são forçados a trocar (já estão configurados).
UPDATE "users" SET "must_change_password" = false;
