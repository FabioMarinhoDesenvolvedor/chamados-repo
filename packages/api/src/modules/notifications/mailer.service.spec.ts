import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MailerService } from './mailer.service';

// ConfigService stub: devolve o mapa dado (ou undefined).
function config(map: Record<string, string | undefined>) {
  return { get: (k: string) => map[k] } as any;
}

test('MailerService: sem SMTP_HOST cai no modo stub e send() não lança', async () => {
  const mailer = new MailerService(config({}));
  assert.equal(mailer.isStub(), true);
  await mailer.send('setor@x', 'Assunto', 'Corpo'); // não lança, só loga
});

test('MailerService: com SMTP_HOST não é stub', () => {
  const mailer = new MailerService(config({ SMTP_HOST: 'smtp.local', SMTP_PORT: '587' }));
  assert.equal(mailer.isStub(), false);
});
