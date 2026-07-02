import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { computePriority } from '../src/modules/tickets/priority.matrix';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('senha123', 10);

  const ti = await prisma.department.upsert({
    where: { name: 'TI' },
    update: {},
    create: { name: 'TI', priorityWeight: 5, isRequesterDept: false, isExecutorDept: true },
  });
  const rh = await prisma.department.upsert({
    where: { name: 'RH' },
    update: {},
    create: { name: 'RH', priorityWeight: 3, isRequesterDept: true, isExecutorDept: true },
  });
  const tesouraria = await prisma.department.findUniqueOrThrow({ where: { name: 'Tesouraria' } });

  // Backfill de segurança: a migration de seed (20260702090200) tenta resolver
  // department_id das 6 categorias de TI via subquery por nome — em um banco
  // criado do zero, TI ainda não existe nesse ponto (só é criado aqui, pelo
  // seed, que roda depois das migrations), então a subquery não encontra nada
  // e o campo fica NULL. Mesmo padrão de correção usado para os flags de TI/RH
  // acima: reaplicar aqui, idempotente (só afeta linhas ainda sem department_id).
  await prisma.ticketCategory.updateMany({
    where: {
      slug: {
        in: [
          'acesso-senhas',
          'computador-equipamentos',
          'sistemas-aplicativos',
          'internet-rede',
          'solicitacoes',
          'outros',
        ],
      },
      departmentId: null,
    },
    data: { departmentId: ti.id },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@chamados.local' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@chamados.local',
      passwordHash,
      role: 'ADMIN',
      departmentId: ti.id,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@chamados.local' },
    update: {},
    create: {
      name: 'Usuário Comum',
      email: 'user@chamados.local',
      passwordHash,
      role: 'USER',
      departmentId: rh.id,
    },
  });

  const existing = await prisma.ticket.count();
  if (existing === 0) {
    // Chamados em triagem: abertos pelo user, ainda sem complexidade/prioridade.
    const triageSamples = [
      {
        title: 'Notebook não liga',
        description: 'O notebook não está ligando mesmo conectado na tomada.',
        department: rh,
      },
      {
        title: 'Resetar senha de e-mail',
        description: 'Esqueci a senha do e-mail corporativo.',
        department: tesouraria,
      },
    ];

    for (const s of triageSamples) {
      const ticket = await prisma.ticket.create({
        data: {
          title: s.title,
          description: s.description,
          complexity: null,
          priority: null,
          status: 'TRIAGE',
          departmentId: s.department.id,
          requesterId: user.id,
          lastActivityBy: user.id,
        },
      });
      await prisma.ticketStatusHistory.create({
        data: { ticketId: ticket.id, fromStatus: null, toStatus: 'TRIAGE', changedBy: user.id },
      });
    }

    // Chamados já triados pelo admin: complexidade definida, prioridade calculada, status OPEN.
    const triagedSamples = [
      {
        title: 'Servidor de arquivos fora do ar',
        description: 'Ninguém consegue acessar a pasta compartilhada.',
        complexity: 'CRITICAL' as const,
        department: ti,
      },
      {
        title: 'Impressora do RH com erro',
        description: 'A impressora do RH não puxa o papel.',
        complexity: 'MEDIUM' as const,
        department: rh,
      },
    ];

    for (const s of triagedSamples) {
      const priority = computePriority(s.complexity, s.department.priorityWeight);
      const ticket = await prisma.ticket.create({
        data: {
          title: s.title,
          description: s.description,
          complexity: s.complexity,
          priority,
          status: 'OPEN',
          departmentId: s.department.id,
          requesterId: user.id,
          lastActivityBy: admin.id,
        },
      });
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          changedBy: user.id,
          fromStatus: null,
          toStatus: 'TRIAGE',
        },
      });
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          changedBy: admin.id,
          fromStatus: 'TRIAGE',
          toStatus: 'OPEN',
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    [
      'Seed concluído.',
      `  admin: ${admin.email} (perfil ADMIN, depto TI)`,
      `  user:  ${user.email} (perfil USER, depto RH)`,
      '  senha (ambos): senha123',
    ].join('\n'),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
