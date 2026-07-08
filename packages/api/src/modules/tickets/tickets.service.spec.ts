import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { SlaService } from './sla.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Captura os argumentos da última chamada a repo.countUnread (escopo por papel/setor).
let lastCountUnreadArgs: { userId: string; scope: unknown } | undefined;

// Constrói o service com dependências stubadas (só o necessário para cada caso).
function makeService(over: {
  ticket?: Record<string, unknown>;
  assignee?: Record<string, unknown> | null;
  subcategory?: Record<string, unknown> | null;
  department?: Record<string, unknown> | null;
  departmentsById?: Record<string, Record<string, unknown>>;
}) {
  // Campos default da projeção de dois relógios (Task 6): sem eles, withSla recebe
  // `undefined` e os testes existentes de create/updateStatus quebram silenciosamente.
  const slaProjectionDefaults = {
    complexity: 'MEDIUM' as const,
    slaStartedAt: null,
    firstResponseAt: null,
    resolvedAt: null,
    department: { priorityWeight: 3 },
  };
  const repo = {
    findById: async () => over.ticket ?? null,
    // assign() não passa pelo withSla (retorna o repo cru) — o stub padrão fica minimal;
    // os testes de captura de 1ª resposta sobrescrevem repo.assign diretamente.
    assign: async (id: string, assignedTo: string, _setFirst: boolean) => ({ id, assignedTo }),
    closeWithRating: async (args: unknown) => args,
    setRating: async (id: string, rating: number) => ({ id, rating }),
    createWithHistory: async (input: Record<string, unknown>) => ({
      ...slaProjectionDefaults,
      id: 'new',
      ...input,
    }),
    // O repo real retorna o ticket atualizado (com `status`, não `toStatus` — esse é só
    // o parâmetro de entrada). O stub precisa espelhar isso para asserções em r.status.
    updateStatusWithHistory: async (input: Record<string, unknown>) => ({
      ...slaProjectionDefaults,
      id: input.id,
      status: input.toStatus,
      ...input,
    }),
    // Registra os argumentos de countUnread para asserção do escopo por setor (Issue 4).
    countUnread: async (userId: string, scope: unknown) => {
      lastCountUnreadArgs = { userId, scope };
      return 7;
    },
    addComment: async (ticketId: string, authorId: string, body: string) => ({
      id: 'c1',
      ticketId,
      authorId,
      body,
      createdAt: new Date(),
      author: {
        id: authorId,
        name: 'Autor',
        email: 'a@x',
        role: 'ADMIN',
        departmentId: null,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  } as any;
  const users = { findById: async () => over.assignee ?? null } as any;
  // Por id (necessário: create() busca o setor do solicitante E o setor executor,
  // que podem ser departamentos diferentes). Sem over.departmentsById, cai no
  // comportamento antigo (mesmo departamento pra qualquer id — regressão dos testes existentes).
  const departments = {
    findById: async (id: string) =>
      over.departmentsById?.[id] ?? over.department ?? { id: 'dep1', priorityWeight: 3, requiresApproval: false },
  } as any;
  const categories = { findSubcategory: async () => over.subcategory ?? null } as any;
  // Stub do PriorityService: cálculo determinístico p/ asserção (complexidade + peso do setor).
  const priority = {
    compute: (complexity: string, weight: number) => `PRIO(${complexity},${weight})`,
  } as any;
  const config = {
    get: (k: string) => (k === 'APP_URL' ? 'https://chamados.local' : undefined),
  } as any;
  // SlaService real (sem I/O, cálculo puro) — os testes de dois relógios precisam de
  // responseDueAt/resolutionDueAt de verdade, não de um stub vazio.
  return new TicketsService(repo, departments, users, priority, new SlaService(), categories, config);
}

const operator: AuthUser = { userId: 'op1', email: 'op@x', role: 'OPERATOR', mustChangePassword: false, departmentId: null, isKiosk: false };
const admin: AuthUser = { userId: 'ad1', email: 'ad@x', role: 'ADMIN', mustChangePassword: false, departmentId: null, isKiosk: false };
const requester: AuthUser = { userId: 'req1', email: 'u@x', role: 'USER', mustChangePassword: false, departmentId: null, isKiosk: false };

// ---- assign ----
test('assign: OPERATOR não pode atribuir a outra pessoa (só assume para si)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' } });
  await assert.rejects(() => svc.assign('t1', 'ad1', operator), (e) => e instanceof ForbiddenException);
});

test('assign: OPERATOR pode assumir o chamado para si', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' }, assignee: { id: 'op1', role: 'OPERATOR' } });
  const r = await svc.assign('t1', 'op1', operator);
  assert.deepEqual(r, { id: 't1', assignedTo: 'op1' });
});

test('assign: ADMIN pode atribuir a um OPERATOR (membro da equipe)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' }, assignee: { id: 'op1', role: 'OPERATOR' } });
  const r = await svc.assign('t1', 'op1', admin);
  assert.deepEqual(r, { id: 't1', assignedTo: 'op1' });
});

test('assign: responsável não pode ser um USER comum', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' }, assignee: { id: 'u9', role: 'USER' } });
  await assert.rejects(() => svc.assign('t1', 'u9', admin), (e) => e instanceof BadRequestException);
});

// ---- close ----
test('close: OPERATOR não pode concluir o chamado (ele resolve, o solicitante/admin conclui)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'RESOLVED' } });
  await assert.rejects(() => svc.close('t1', 5, operator), (e) => e instanceof ForbiddenException);
});

test('close: o solicitante pode concluir um chamado RESOLVED', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'RESOLVED' } });
  const r = await svc.close('t1', 5, requester);
  assert.equal((r as any).id, 't1');
});

test('close: solicitante avalia um chamado CLOSED ainda sem nota (encerrado direto pelo admin)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'CLOSED', rating: null } });
  const r = await svc.close('t1', 4, requester);
  assert.deepEqual(r, { id: 't1', rating: 4 });
});

test('close: chamado CLOSED já avaliado não pode ser avaliado de novo', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'CLOSED', rating: 5 } });
  await assert.rejects(() => svc.close('t1', 3, requester), (e) => e instanceof BadRequestException);
});

test('close: avaliar um chamado CLOSED exige a nota', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'CLOSED', rating: null } });
  await assert.rejects(() => svc.close('t1', undefined, requester), (e) => e instanceof BadRequestException);
});

// ---- create (categorização guiada) ----
const subRedefinicao = {
  id: 's1',
  categoryId: 'c1',
  name: 'Redefinição de senha',
  category: { id: 'c1', name: 'Acesso e Senhas', departmentId: 'dep1' },
  details: [],
};

// Subcategoria COM 3º nível (ex.: Monitor).
const subMonitor = {
  id: 's2',
  categoryId: 'c2',
  name: 'Monitor',
  category: { id: 'c2', name: 'Computador e Equipamentos', departmentId: 'dep1' },
  details: [
    { id: 'd1', name: 'Não liga' },
    { id: 'd2', name: 'Sem imagem ou sinal' },
  ],
};

test('create: deriva o título "Categoria › Subcategoria" e valida a subcategoria', async () => {
  const svc = makeService({ subcategory: subRedefinicao });
  const r: any = await svc.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Acesso e Senhas › Redefinição de senha');
  assert.equal(r.categoryId, 'c1');
  assert.equal(r.subcategoryId, 's1');
});

test('create: rejeita subcategoria que não pertence à categoria informada', async () => {
  const svc = makeService({ subcategory: subRedefinicao });
  await assert.rejects(
    () => svc.create({ categoryId: 'OUTRA', subcategoryId: 's1', departmentId: 'dep1' } as any, admin),
    (e) => e instanceof BadRequestException,
  );
});

test('create: com detalhe válido deriva o título de 3 níveis e grava detailOptionId', async () => {
  const svc = makeService({ subcategory: subMonitor });
  const r: any = await svc.create(
    { categoryId: 'c2', subcategoryId: 's2', detailOptionId: 'd1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Computador e Equipamentos › Monitor › Não liga');
  assert.equal(r.detailOptionId, 'd1');
});

test('create: com detalhes, criar SEM detalhe é permitido (opcional) e usa a complexidade da subcategoria', async () => {
  const svc = makeService({ subcategory: { ...subMonitor, baseComplexity: 'HIGH' } });
  const r: any = await svc.create(
    { categoryId: 'c2', subcategoryId: 's2', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Computador e Equipamentos › Monitor'); // 2 níveis, sem detalhe
  assert.equal(r.detailOptionId, null);
  assert.equal(r.complexity, 'HIGH'); // complexidade-base da subcategoria
});

test('create: rejeita detalhe que não pertence à subcategoria', async () => {
  const svc = makeService({ subcategory: subMonitor });
  await assert.rejects(
    () => svc.create(
      { categoryId: 'c2', subcategoryId: 's2', detailOptionId: 'OUTRO', departmentId: 'dep1' } as any,
      admin,
    ),
    (e) => e instanceof BadRequestException,
  );
});

test('create: subcategoria sem detalhes ignora detailOptionId ausente (regressão) e rejeita detalhe indevido', async () => {
  const ok = makeService({ subcategory: subRedefinicao });
  const r: any = await ok.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Acesso e Senhas › Redefinição de senha');
  assert.equal(r.detailOptionId, null);

  const bad = makeService({ subcategory: subRedefinicao });
  await assert.rejects(
    () => bad.create(
      { categoryId: 'c1', subcategoryId: 's1', detailOptionId: 'd1', departmentId: 'dep1' } as any,
      admin,
    ),
    (e) => e instanceof BadRequestException,
  );
});

// ---- create (prioridade/SLA automáticos na abertura — Item 2) ----
test('create: nasce priorizado — complexidade-base default MÉDIA e prioridade pelo peso do setor', async () => {
  // subRedefinicao: sem detalhes e sem base_complexity → cai no default MÉDIA.
  const svc = makeService({ subcategory: subRedefinicao });
  const r: any = await svc.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.complexity, 'MEDIUM');
  assert.equal(r.priority, 'PRIO(MEDIUM,3)'); // compute(complexidade, peso_setor=3)
});

test('create: usa a complexidade-base da subcategoria quando definida', async () => {
  const svc = makeService({ subcategory: { ...subRedefinicao, baseComplexity: 'HIGH' } });
  const r: any = await svc.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.complexity, 'HIGH');
  assert.equal(r.priority, 'PRIO(HIGH,3)');
});

test('create: a complexidade-base do detalhe tem precedência sobre a da subcategoria', async () => {
  const sub = {
    ...subMonitor,
    baseComplexity: 'LOW',
    details: [{ id: 'd1', name: 'Não liga', baseComplexity: 'CRITICAL' }],
  };
  const svc = makeService({ subcategory: sub });
  const r: any = await svc.create(
    { categoryId: 'c2', subcategoryId: 's2', detailOptionId: 'd1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.complexity, 'CRITICAL');
  assert.equal(r.priority, 'PRIO(CRITICAL,3)');
});

// ---- create (originLocation — captura só de solicitante kiosk / Plano 4 totem) ----
const kiosk: AuthUser = { userId: 'kiosk1', email: 'kiosk@x', role: 'USER', mustChangePassword: false, departmentId: null, isKiosk: true };

test('create: kiosk SEM originLocation rejeita com 400', async () => {
  const svc = makeService({ subcategory: subRedefinicao, assignee: { id: 'kiosk1', departmentId: 'dep1' } });
  await assert.rejects(
    () => svc.create({ categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any, kiosk),
    (e) => e instanceof BadRequestException,
  );
});

test('create: kiosk com originLocation em branco (só espaços) rejeita com 400', async () => {
  const svc = makeService({ subcategory: subRedefinicao, assignee: { id: 'kiosk1', departmentId: 'dep1' } });
  await assert.rejects(
    () => svc.create(
      { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1', originLocation: '   ' } as any,
      kiosk,
    ),
    (e) => e instanceof BadRequestException,
  );
});

test('create: kiosk com originLocation passa o valor (trimado) ao repo', async () => {
  const svc = makeService({
    subcategory: subRedefinicao,
    assignee: { id: 'kiosk1', departmentId: 'dep1' }, // users.findById(user.userId) — USER exige setor
  });
  const r: any = await svc.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1', originLocation: '  Recepção  ' } as any,
    kiosk,
  );
  assert.equal(r.originLocation, 'Recepção');
});

test('create: usuário comum enviando originLocation é ignorado (gravado como null)', async () => {
  const svc = makeService({ subcategory: subRedefinicao });
  const r: any = await svc.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1', originLocation: 'Recepção' } as any,
    admin,
  );
  assert.equal(r.originLocation, null);
});

// ---- addComment (bloqueio em chamado encerrado) ----
test('addComment: ADMIN não pode comentar em chamado RESOLVED', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'RESOLVED' } });
  await assert.rejects(() => svc.addComment('t1', 'oi', admin), (e) => e instanceof ForbiddenException);
});

test('addComment: ninguém comenta em chamado CLOSED (nem admin)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'CLOSED' } });
  await assert.rejects(() => svc.addComment('t1', 'oi', admin), (e) => e instanceof ForbiddenException);
});

test('addComment: chamado em andamento aceita comentário', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'IN_PROGRESS' } });
  const r = await svc.addComment('t1', 'oi', admin);
  assert.equal((r as any).id, 'c1');
});

// ---- hideByRole (projeção por papel) ----
const ticketFields = { priority: 'HIGH' as const, complexity: 'CRITICAL' as const, rating: 4 };

test('hideByRole: USER não vê prioridade/complexidade/nota/breach, mas sabe se já avaliou (rated)', () => {
  const svc = makeService({});
  const r = (svc as any).hideByRole({ ...ticketFields }, requester);
  assert.deepEqual(r, {
    priority: null, complexity: null, rating: null, rated: true,
    responseBreached: undefined, resolutionBreached: undefined,
  });
});

test('hideByRole: OPERATOR vê prioridade/complexidade, mas NÃO a nota', () => {
  const svc = makeService({});
  const r = (svc as any).hideByRole({ ...ticketFields }, operator);
  assert.deepEqual(r, { priority: 'HIGH', complexity: 'CRITICAL', rating: null, rated: true });
});

test('hideByRole: ADMIN vê tudo', () => {
  const svc = makeService({});
  const r = (svc as any).hideByRole({ ...ticketFields }, admin);
  assert.deepEqual(r, { ...ticketFields, rated: true });
});

// ---- create (roteamento categoria→setor executor + aprovação) ----
const subManutencaoEletrica = {
  id: 's-eletrica',
  categoryId: 'c-eletrica',
  name: 'Solicitação geral',
  category: { id: 'c-eletrica', name: 'Elétrica', departmentId: 'dep-manutencao' },
  details: [],
};

const subPresidencia = {
  id: 's-presidencia',
  categoryId: 'c-presidencia',
  name: 'Solicitação geral',
  category: { id: 'c-presidencia', name: 'Assessoria', departmentId: 'dep-presidencia' },
  details: [],
};

const subSemSetor = {
  id: 's-sem-setor',
  categoryId: 'c-sem-setor',
  name: 'Solicitação geral',
  category: { id: 'c-sem-setor', name: 'Sem setor', departmentId: null },
  details: [],
};

test('create: resolve executorDepartmentId pela categoria e nasce OPEN quando o setor não exige aprovação', async () => {
  const svc = makeService({
    subcategory: subManutencaoEletrica,
    departmentsById: {
      dep1: { id: 'dep1', priorityWeight: 3, requiresApproval: false },
      'dep-manutencao': { id: 'dep-manutencao', priorityWeight: 4, requiresApproval: false },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-eletrica', subcategoryId: 's-eletrica', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.executorDepartmentId, 'dep-manutencao');
  assert.equal(r.status, 'OPEN');
});

test('create: chamado nasce sempre OPEN (aprovação removida)', async () => {
  const svc = makeService({
    subcategory: {
      id: 'sub', categoryId: 'cat', baseComplexity: 'MEDIUM', details: [],
      category: { id: 'cat', name: 'Rede', departmentId: 'exec' },
      name: 'Lentidão',
    },
    department: { id: 'dep', name: 'RH', priorityWeight: 3 },
    departmentsById: {
      dep: { id: 'dep', name: 'RH', priorityWeight: 3 },
      exec: { id: 'exec', name: 'TI', priorityWeight: 5, requiresApproval: true, notificationEmail: null },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'cat', subcategoryId: 'sub', description: null } as any,
    { userId: 'u1', role: 'ADMIN', departmentId: null } as AuthUser,
  );
  assert.equal(r.status, 'OPEN'); // mesmo com requiresApproval=true no setor executor
});

test('create: categoria sem departmentId (não roteada) rejeita com 400', async () => {
  const svc = makeService({ subcategory: subSemSetor });
  await assert.rejects(
    () => svc.create({ categoryId: 'c-sem-setor', subcategoryId: 's-sem-setor', departmentId: 'dep1' } as any, admin),
    (e) => e instanceof BadRequestException,
  );
});

test('create: setor executor com notificationEmail enfileira notificação (payload no repo)', async () => {
  const svc = makeService({
    subcategory: subManutencaoEletrica,
    assignee: { id: 'ad1', name: 'Admin', role: 'ADMIN' }, // vira o requester carregado
    departmentsById: {
      dep1: { id: 'dep1', name: 'Tesouraria', priorityWeight: 3, requiresApproval: false },
      'dep-manutencao': {
        id: 'dep-manutencao',
        name: 'Manutenção',
        priorityWeight: 4,
        requiresApproval: false,
        notificationEmail: 'manutencao@clube.local',
      },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-eletrica', subcategoryId: 's-eletrica', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.notification.toEmail, 'manutencao@clube.local');
  assert.equal(r.notification.emailInput.requesterDepartmentName, 'Tesouraria');
  assert.equal(r.notification.emailInput.priority, 'PRIO(MEDIUM,3)');
  assert.equal(r.notification.emailInput.title, 'Elétrica › Solicitação geral');
});

test('create: setor executor sem notificationEmail não enfileira notificação', async () => {
  const svc = makeService({
    subcategory: subManutencaoEletrica,
    departmentsById: {
      dep1: { id: 'dep1', name: 'Tesouraria', priorityWeight: 3, requiresApproval: false },
      'dep-manutencao': { id: 'dep-manutencao', name: 'Manutenção', priorityWeight: 4, requiresApproval: false },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-eletrica', subcategoryId: 's-eletrica', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.notification, undefined);
});

// ---- listWhere (RBAC por setor) ----
const operatorManutencao: AuthUser = {
  userId: 'op2', email: 'op2@x', role: 'OPERATOR', mustChangePassword: false,
  departmentId: 'dep-manutencao', isKiosk: false,
};

test('listWhere: OPERATOR sem departmentId vê tudo (regressão)', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({}, operator);
  assert.equal(where.executorDepartmentId, undefined);
});

test('listWhere: OPERATOR com departmentId só vê o próprio setor executor', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({}, operatorManutencao);
  assert.equal(where.executorDepartmentId, 'dep-manutencao');
  assert.deepEqual(where.status, { notIn: ['PENDING_APPROVAL'] });
});

test('listWhere: ADMIN nunca é restrito por setor', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({}, admin);
  assert.equal(where.executorDepartmentId, undefined);
});

test('listWhere: status explícito na query tem prioridade (OPERATOR pode filtrar PENDING_APPROVAL se quiser)', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({ status: 'PENDING_APPROVAL' }, operatorManutencao);
  assert.equal(where.status, 'PENDING_APPROVAL');
});

// ---- ensureCanView / detail (RBAC por setor) ----
test('detail: OPERATOR de outro setor não acessa o chamado (403)', () => {
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: 'dep-limpeza', comments: [], attachments: [] },
  });
  // ensureCanView é síncrono (lança direto, não retorna Promise) — assert.throws é o
  // matcher correto aqui; assert.rejects só captura throws síncronos dentro de fn async.
  assert.throws(
    () => (svc as any).ensureCanView(
      { requesterId: 'req1', executorDepartmentId: 'dep-limpeza' },
      operatorManutencao,
    ),
    (e: unknown) => e instanceof ForbiddenException,
  );
});

test('detail: OPERATOR do mesmo setor acessa o chamado', () => {
  const svc = makeService({});
  (svc as any).ensureCanView(
    { requesterId: 'req1', executorDepartmentId: 'dep-manutencao' },
    operatorManutencao,
  );
  // não lança — sucesso implícito
});

// ---- assign/updateStatus respeitam o setor do OPERATOR ----
test('assign: OPERATOR de outro setor não pode assumir chamado fora do seu setor', async () => {
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: 'dep-limpeza' },
    assignee: { id: 'op2', role: 'OPERATOR' },
  });
  await assert.rejects(
    () => svc.assign('t1', 'op2', operatorManutencao),
    (e) => e instanceof ForbiddenException,
  );
});

test('updateStatus: rejeita PENDING_APPROVAL como alvo manual', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: null, status: 'OPEN' } });
  await assert.rejects(
    () => svc.updateStatus('t1', 'PENDING_APPROVAL', admin),
    (e) => e instanceof BadRequestException,
  );
});

test('updateStatus: rejeita transição a partir de PENDING_APPROVAL (só approve() tira do gate)', async () => {
  // Furo do gate de aprovação: um OPERATOR não pode "aprovar por fora" mudando o status
  // direto de PENDING_APPROVAL para OPEN/IN_PROGRESS — a única saída é o approve() (ADMIN).
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: null, status: 'PENDING_APPROVAL' },
  });
  await assert.rejects(
    () => svc.updateStatus('t1', 'IN_PROGRESS', operator),
    (e) => e instanceof BadRequestException,
  );
});

// ---- unreadCount (escopo por setor executor — Issue 4) ----
test('unreadCount: OPERATOR escopado conta não-lidos só do próprio setor executor', async () => {
  const svc = makeService({});
  const r = await svc.unreadCount(operatorManutencao);
  assert.equal(r.count, 7);
  assert.equal((lastCountUnreadArgs?.scope as any).executorDepartmentId, 'dep-manutencao');
  assert.equal((lastCountUnreadArgs?.scope as any).onlyOwn, false);
});

test('unreadCount: OPERATOR global (sem setor) conta tudo — regressão', async () => {
  const svc = makeService({});
  await svc.unreadCount(operator);
  assert.equal((lastCountUnreadArgs?.scope as any).executorDepartmentId, undefined);
  assert.equal((lastCountUnreadArgs?.scope as any).onlyOwn, false);
});

test('unreadCount: USER conta só os próprios chamados', async () => {
  const svc = makeService({});
  await svc.unreadCount(requester);
  assert.equal((lastCountUnreadArgs?.scope as any).onlyOwn, true);
  assert.equal((lastCountUnreadArgs?.scope as any).executorDepartmentId, undefined);
});

// ---- dois relógios de SLA / captura da 1ª resposta (Task 6) ----
test('assign grava first_response_at quando ainda nulo', async () => {
  let assignArgs: any;
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, firstResponseAt: null },
    assignee: { id: 'op1', role: 'OPERATOR' },
  });
  (svc as any).repo.assign = async (id: string, to: string, setFirst: boolean) => {
    assignArgs = { id, to, setFirst };
    return { id, assignedTo: to, department: { priorityWeight: 3 } };
  };
  await svc.assign('t1', 'op1', { userId: 'op1', role: 'OPERATOR', departmentId: null } as AuthUser);
  assert.equal(assignArgs.setFirst, true);
});

test('assign NÃO regrava first_response_at se já respondido', async () => {
  let assignArgs: any;
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, firstResponseAt: new Date() },
    assignee: { id: 'op1', role: 'OPERATOR' },
  });
  (svc as any).repo.assign = async (id: string, to: string, setFirst: boolean) => {
    assignArgs = { setFirst };
    return { id, assignedTo: to, department: { priorityWeight: 3 } };
  };
  await svc.assign('t1', 'op1', { userId: 'op1', role: 'OPERATOR', departmentId: null } as AuthUser);
  assert.equal(assignArgs.setFirst, false);
});

test('updateStatus para IN_PROGRESS grava first_response_at quando nulo', async () => {
  let statusArgs: any;
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, status: 'OPEN', firstResponseAt: null },
  });
  (svc as any).repo.updateStatusWithHistory = async (input: any) => {
    statusArgs = input;
    return { id: input.id, status: input.toStatus, complexity: 'MEDIUM', slaStartedAt: new Date(), firstResponseAt: input.firstResponseAt ?? null, resolvedAt: null, department: { priorityWeight: 3 } };
  };
  await svc.updateStatus('t1', 'IN_PROGRESS', { userId: 'a', role: 'ADMIN', departmentId: null } as AuthUser);
  assert.ok(statusArgs.firstResponseAt instanceof Date);
});

test('projeção do staff traz os dois prazos e breach', async () => {
  const past = new Date(Date.now() - 100 * 3600 * 1000); // 100h atrás -> estourado
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, status: 'OPEN', firstResponseAt: null },
  });
  (svc as any).repo.updateStatusWithHistory = async (input: any) => ({
    id: input.id, status: input.toStatus, complexity: 'MEDIUM', slaStartedAt: past,
    firstResponseAt: input.firstResponseAt ?? null, resolvedAt: null, department: { priorityWeight: 3 },
  });
  const r: any = await svc.updateStatus('t1', 'RESOLVED', { userId: 'a', role: 'ADMIN', departmentId: null } as AuthUser);
  assert.equal(typeof r.responseSlaHours, 'number');
  assert.equal(typeof r.resolutionSlaHours, 'number');
  assert.equal(r.resolutionBreached, true); // 100h > qualquer célula
});

test('projeção do USER esconde breach (undefined)', async () => {
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, status: 'OPEN', firstResponseAt: null },
  });
  (svc as any).repo.updateStatusWithHistory = async (input: any) => ({
    id: input.id, status: input.toStatus, complexity: 'MEDIUM', slaStartedAt: new Date(),
    firstResponseAt: null, resolvedAt: null, department: { priorityWeight: 3 },
  });
  const r: any = await svc.updateStatus('t1', 'IN_PROGRESS', { userId: 'u1', role: 'USER', departmentId: null } as AuthUser);
  assert.equal(r.responseBreached, undefined);
  assert.equal(r.resolutionBreached, undefined);
  assert.equal(typeof r.resolutionSlaHours, 'number'); // prazo continua visível ao usuário
});
