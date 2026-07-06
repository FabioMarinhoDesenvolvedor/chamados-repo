import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { NotificationOutboxRepository } from './notification-outbox.repository';
import { MailWorker } from './mail-worker.service';

// PrismaModule é @Global() (ver prisma/prisma.module.ts) — não precisa import aqui.
// ConfigModule também é global (isGlobal: true no app.module.ts) — MailerService
// injeta ConfigService sem import extra.
@Module({
  providers: [MailerService, NotificationOutboxRepository, MailWorker],
})
export class NotificationsModule {}
