import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from './mailer.service';
import { NotificationOutboxRepository } from './notification-outbox.repository';

// Processa a fila de e-mails. Single-process (systemd): a guarda `running` evita ciclos
// concorrentes. 3 tentativas por linha; depois FAILED (só log, sem UI de reenvio no MVP).
@Injectable()
export class MailWorker {
  private readonly logger = new Logger('MailWorker');
  private running = false;

  constructor(
    private readonly outbox: NotificationOutboxRepository,
    private readonly mailer: MailerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.outbox.findPending(20);
      for (const row of pending) {
        try {
          await this.mailer.send(row.toEmail, row.subject, row.body);
          await this.outbox.markSent(row.id);
        } catch (err) {
          const msg = (err as Error).message;
          const updated = await this.outbox.markFailed(row.id, row.attempts, msg);
          if (updated.status === 'FAILED') {
            this.logger.error(
              `Notificação ${row.id} FALHOU após ${updated.attempts} tentativas: ${msg}`,
            );
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
