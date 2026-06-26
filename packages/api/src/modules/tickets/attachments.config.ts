import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

/**
 * Pasta dos anexos — FORA do programa e configurável por env `ATTACHMENTS_DIR`.
 * Os arquivos são gravados cifrados (ver VaultService). Default: uma pasta
 * `chamados-anexos` acima da raiz do repositório (cwd = packages/api).
 * Lido de forma preguiçosa para garantir que o .env já foi carregado.
 */
export function attachmentsDir(): string {
  const env = process.env.ATTACHMENTS_DIR;
  if (env && env.trim()) {
    return isAbsolute(env) ? env : resolve(process.cwd(), env);
  }
  return resolve(process.cwd(), '..', '..', '..', 'chamados-anexos');
}

export function ensureAttachmentsDir(): void {
  const dir = attachmentsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// URL do anexo: endpoint autenticado (não há mais arquivo público).
export function attachmentUrl(ticketId: string, attachmentId: string): string {
  return `/api/tickets/${ticketId}/attachments/${attachmentId}`;
}

// memoryStorage: o buffer chega à aplicação para ser cifrado antes de ir ao disco.
export const multerOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new BadRequestException('Apenas imagens são permitidas (PNG, JPG, GIF, WEBP)'), false);
  },
};
