import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MailWorker } from './mail-worker.service';

function makeWorker(over: {
  pending?: any[];
  sendImpl?: () => Promise<void>;
}) {
  const calls: { sent: string[]; failed: { id: string; attempts: number }[] } = {
    sent: [],
    failed: [],
  };
  const outbox = {
    findPending: async () => over.pending ?? [],
    markSent: async (id: string) => {
      calls.sent.push(id);
      return { id, status: 'SENT', attempts: 0 };
    },
    markFailed: async (id: string, attempts: number) => {
      calls.failed.push({ id, attempts });
      const next = attempts + 1;
      return { id, status: next >= 3 ? 'FAILED' : 'PENDING', attempts: next };
    },
  } as any;
  const mailer = {
    send: over.sendImpl ?? (async () => undefined),
  } as any;
  return { worker: new MailWorker(outbox, mailer), calls };
}

test('MailWorker: envio ok marca SENT', async () => {
  const { worker, calls } = makeWorker({
    pending: [{ id: 'n1', toEmail: 'a@x', subject: 's', body: 'b', attempts: 0 }],
  });
  await worker.process();
  assert.deepEqual(calls.sent, ['n1']);
  assert.equal(calls.failed.length, 0);
});

test('MailWorker: erro no envio chama markFailed com as tentativas atuais', async () => {
  const { worker, calls } = makeWorker({
    pending: [{ id: 'n1', toEmail: 'a@x', subject: 's', body: 'b', attempts: 2 }],
    sendImpl: async () => {
      throw new Error('smtp caiu');
    },
  });
  await worker.process();
  assert.equal(calls.sent.length, 0);
  assert.deepEqual(calls.failed, [{ id: 'n1', attempts: 2 }]); // markFailed decide o FAILED
});
