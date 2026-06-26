import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import { isAbsolute, join, resolve } from 'path';

const PREFIX = 'chamados-';
const SUFFIX = '.sql.gz';

@Injectable()
export class BackupService {
  private readonly logger = new Logger('BackupService');
  private running = false;

  constructor(private readonly config: ConfigService) {}

  // Pasta dos backups — FORA do programa, configurável por env BACKUP_DIR.
  // Para ficar "fora do servidor", aponte para um drive de rede/disco externo.
  directory(): string {
    const env = this.config.get<string>('BACKUP_DIR');
    if (env && env.trim()) return isAbsolute(env) ? env : resolve(process.cwd(), env);
    return resolve(process.cwd(), '..', '..', '..', 'chamados-backups');
  }

  private retention(): number {
    const n = Number(this.config.get<string>('BACKUP_KEEP') ?? 14);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
  }

  private pgDump(): string {
    return this.config.get<string>('PG_DUMP_PATH') ?? 'pg_dump';
  }

  private parseDb() {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) throw new ServiceUnavailableException('DATABASE_URL não configurada');
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'postgres',
    };
  }

  // Se o Postgres roda em container (este projeto: chamados-db), o pg_dump é executado
  // via `docker exec` dentro dele. Configurável por env BACKUP_DOCKER_CONTAINER.
  private dockerContainer(): string {
    return (this.config.get<string>('BACKUP_DOCKER_CONTAINER') ?? '').trim();
  }

  // Todos os dias às 02:00 (madrugada).
  @Cron('0 2 * * *')
  async scheduledBackup(): Promise<void> {
    try {
      const res = await this.runBackup();
      this.logger.log(`Backup automático concluído: ${res.filename} (${res.size} bytes)`);
    } catch (err) {
      this.logger.error(`Backup automático falhou: ${(err as Error).message}`);
    }
  }

  async runBackup(): Promise<{ filename: string; size: number }> {
    if (this.running) throw new ServiceUnavailableException('Já existe um backup em andamento');
    this.running = true;

    const dir = this.directory();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const filename = `${PREFIX}${stamp}${SUFFIX}`;
    const fullPath = join(dir, filename);

    try {
      await this.dumpToFile(fullPath);
      this.prune(dir);
      return { filename, size: statSync(fullPath).size };
    } catch (err) {
      if (existsSync(fullPath)) {
        try {
          unlinkSync(fullPath);
        } catch {
          /* arquivo parcial: ignora se não der pra remover */
        }
      }
      throw err;
    } finally {
      this.running = false;
    }
  }

  list(): { filename: string; size: number; createdAt: string }[] {
    const dir = this.directory();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX))
      .map((f) => {
        const s = statSync(join(dir, f));
        return { filename: f, size: s.size, createdAt: s.mtime.toISOString() };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  // pg_dump (SQL puro) → gzip → arquivo. O .sql.gz é o "dump enorme" para recuperação.
  private dumpToFile(fullPath: string): Promise<void> {
    return new Promise<void>((resolvePromise, reject) => {
      const db = this.parseDb();
      const container = this.dockerContainer();
      const dumpArgs = [
        '-h',
        container ? '127.0.0.1' : db.host,
        '-p',
        container ? '5432' : db.port,
        '-U',
        db.user,
        '-d',
        db.database,
        '--no-owner',
        '--no-privileges',
      ];

      let cmd: string;
      let args: string[];
      const env = { ...process.env };
      if (container) {
        // docker exec injeta a senha como env dentro do container.
        cmd = 'docker';
        args = ['exec', '-e', `PGPASSWORD=${db.password}`, container, 'pg_dump', ...dumpArgs];
      } else {
        cmd = this.pgDump();
        args = dumpArgs;
        env.PGPASSWORD = db.password;
      }

      const child = spawn(cmd, args, { windowsHide: true, env });
      const gzip = createGzip();
      const out = createWriteStream(fullPath);
      let stderr = '';
      let closedOk = false;
      let finished = false;
      let settled = false;

      const done = () => {
        if (closedOk && finished && !settled) {
          settled = true;
          resolvePromise();
        }
      };
      const fail = (e: Error) => {
        if (!settled) {
          settled = true;
          reject(e);
        }
      };

      child.on('error', (e) =>
        fail(new Error(`Falha ao executar backup (${cmd}): ${e.message}`)),
      );
      child.stderr.on('data', (d) => (stderr += d.toString()));
      gzip.on('error', fail);
      out.on('error', fail);
      out.on('finish', () => {
        finished = true;
        done();
      });

      child.stdout.pipe(gzip).pipe(out);

      child.on('close', (code) => {
        if (code === 0) {
          closedOk = true;
          done();
        } else {
          fail(new Error(`pg_dump terminou com código ${code}: ${stderr.trim()}`));
        }
      });
    });
  }

  private prune(dir: string): void {
    const keep = this.retention();
    const files = readdirSync(dir)
      .filter((f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(keep).forEach((x) => {
      try {
        unlinkSync(join(dir, x.f));
      } catch {
        /* ignora falha ao remover backup antigo */
      }
    });
  }
}
