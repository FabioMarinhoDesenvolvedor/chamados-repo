import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Envia e-mails de notificação. Sem SMTP_HOST configurado, opera em modo STUB: só loga
// (dev/CI/smoke, sem servidor SMTP). Com SMTP_* presentes, envia de verdade (produção).
@Injectable()
export class MailerService {
  private readonly logger = new Logger('MailerService');
  private readonly stub: boolean;
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.stub = !host || !host.trim();
    this.transporter = this.stub
      ? null
      : nodemailer.createTransport({
          host: host as string,
          port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
          auth: this.auth(),
        });
  }

  private auth(): { user: string; pass: string } | undefined {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    return user && pass ? { user, pass } : undefined;
  }

  isStub(): boolean {
    return this.stub;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (this.stub) {
      this.logger.log(`[STUB] SMTP não configurado — e-mail NÃO enviado. Para: ${to} | ${subject}`);
      return;
    }
    const from = this.config.get<string>('SMTP_FROM') ?? 'chamados@localhost';
    await this.transporter!.sendMail({ from, to, subject, text: body });
  }
}
