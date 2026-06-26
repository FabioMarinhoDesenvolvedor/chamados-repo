import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { attachmentsDir } from '../tickets/attachments.config';

export type VaultStatus = 'UNINITIALIZED' | 'LOCKED' | 'UNLOCKED';

const SENTINEL = Buffer.from('chamados-vault-ok');
const ALGO = 'aes-256-gcm';

interface VaultMeta {
  salt: string; // hex
  verifier: string; // hex (iv+tag+ciphertext do SENTINEL)
}

/**
 * Cofre de anexos: a chave AES-256 é derivada de uma senha-mestra que o admin
 * digita e NUNCA é persistida — fica só em memória até o servidor reiniciar.
 * Sem desbloquear, não dá para cifrar (upload) nem decifrar (visualizar).
 */
@Injectable()
export class VaultService {
  private key: Buffer | null = null;

  private metaPath(): string {
    return join(attachmentsDir(), 'vault.meta.json');
  }

  private readMeta(): VaultMeta | null {
    const path = this.metaPath();
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as VaultMeta;
  }

  getStatus(): VaultStatus {
    if (this.key) return 'UNLOCKED';
    return this.readMeta() ? 'LOCKED' : 'UNINITIALIZED';
  }

  isUnlocked(): boolean {
    return this.key !== null;
  }

  assertUnlocked(): void {
    if (!this.key) {
      // 423 Locked: cofre bloqueado, ação indisponível até o admin desbloquear.
      throw new HttpException('Cofre de anexos bloqueado. Um administrador precisa desbloqueá-lo.', 423);
    }
  }

  // Primeiro uso define a senha-mestra; depois, valida contra o verificador salvo.
  unlock(password: string): VaultStatus {
    const dir = attachmentsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const meta = this.readMeta();
    if (!meta) {
      const salt = randomBytes(16);
      const key = scryptSync(password, salt, 32);
      const verifier = this.seal(SENTINEL, key);
      const newMeta: VaultMeta = { salt: salt.toString('hex'), verifier: verifier.toString('hex') };
      writeFileSync(this.metaPath(), JSON.stringify(newMeta), 'utf8');
      this.key = key;
      return 'UNLOCKED';
    }

    const key = scryptSync(password, Buffer.from(meta.salt, 'hex'), 32);
    try {
      const opened = this.open(Buffer.from(meta.verifier, 'hex'), key);
      if (opened.length !== SENTINEL.length || !timingSafeEqual(opened, SENTINEL)) {
        throw new Error('mismatch');
      }
    } catch {
      throw new UnauthorizedException('Senha-mestra incorreta');
    }
    this.key = key;
    return 'UNLOCKED';
  }

  lock(): void {
    this.key = null;
  }

  encrypt(buffer: Buffer): Buffer {
    this.assertUnlocked();
    return this.seal(buffer, this.key as Buffer);
  }

  decrypt(buffer: Buffer): Buffer {
    this.assertUnlocked();
    return this.open(buffer, this.key as Buffer);
  }

  // [iv(12) | authTag(16) | ciphertext]
  private seal(buffer: Buffer, key: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]);
  }

  private open(blob: Buffer, key: Buffer): Buffer {
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const data = blob.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}
