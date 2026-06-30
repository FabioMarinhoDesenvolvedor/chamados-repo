import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket,
  TicketStatus,
  TICKET_STATUSES,
  UserPublic,
  isStaffRole,
} from '@chamados/shared';
import { useAuth } from '@/auth/auth-context';
import { useAssignTicket, useTickets, useUpdateStatus } from '@/features/tickets/api';
import { useUsers } from '@/features/users/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { STATUS_LABEL } from '@/lib/labels';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];
// Status que dá para definir rápido pelo dashboard (resolver coisas simples sem abrir o chamado).
const QUICK_STATUSES: TicketStatus[] = ['TRIAGE', 'IN_PROGRESS', 'RESOLVED'];

// Ações de atendimento direto na lista (só staff): mudar status e definir responsável.
function TicketActions({
  ticket,
  isAdmin,
  staffUsers,
  currentUserId,
}: {
  ticket: Ticket;
  isAdmin: boolean;
  staffUsers: UserPublic[];
  currentUserId?: string;
}) {
  const updateStatus = useUpdateStatus(ticket.id);
  const assignTicket = useAssignTicket(ticket.id);
  // Garante que o status atual apareça no seletor mesmo se não for um dos "rápidos" (ex.: OPEN/CLOSED).
  const statusOptions = QUICK_STATUSES.includes(ticket.status)
    ? QUICK_STATUSES
    : [ticket.status, ...QUICK_STATUSES];
  const busy = updateStatus.isPending || assignTicket.isPending;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        aria-label="Alterar status"
        className="min-h-0 py-1 text-xs"
        value={ticket.status}
        disabled={busy}
        onChange={(e) => updateStatus.mutate({ status: e.target.value as TicketStatus })}
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      {isAdmin ? (
        <Select
          aria-label="Definir responsável"
          className="min-h-0 py-1 text-xs"
          value={ticket.assignedTo ?? ''}
          disabled={busy}
          onChange={(e) => e.target.value && assignTicket.mutate({ assignedTo: e.target.value })}
        >
          <option value="" disabled>
            Responsável...
          </option>
          {staffUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      ) : ticket.assignedTo === currentUserId ? (
        <span className="text-xs text-gray-500">Você é o responsável</span>
      ) : (
        // OPERATOR só pode assumir o chamado para si.
        <Button
          variant="secondary"
          className="min-h-0 px-2 py-1 text-xs"
          loading={assignTicket.isPending}
          onClick={() => currentUserId && assignTicket.mutate({ assignedTo: currentUserId })}
        >
          Assumir
        </Button>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  // Staff (ADMIN/OPERATOR): vê KPIs e ações de atendimento.
  const isStaff = user ? isStaffRole(user.role) : false;
  const isAdmin = user?.role === 'ADMIN';
  // Lista de responsáveis possíveis (equipe) p/ o admin atribuir pela lista. OPERATOR só assume p/ si.
  const { data: allUsers } = useUsers(isAdmin);
  const staffUsers = allUsers?.filter((u) => isStaffRole(u.role)) ?? [];
  // OPERATOR não abre chamados (só atende); USER e ADMIN sim.
  const canCreate = user?.role !== 'OPERATOR';
  // 'ACTIVE' (padrão) = só chamados em aberto/andamento; '' = todos; ou um status específico.
  const [status, setStatus] = useState<TicketStatus | '' | 'ACTIVE'>('ACTIVE');
  const { data: tickets, isLoading } = useTickets({
    status: status === 'ACTIVE' || status === '' ? undefined : status,
  });

  const all = tickets ?? [];
  // Visão padrão "limpa": esconde resolvidos/concluídos até o usuário filtrar.
  const visible = status === 'ACTIVE' ? all.filter((t) => !DONE.includes(t.status)) : all;
  const kpis = {
    triagem: all.filter((t) => t.status === 'TRIAGE').length,
    abertos: all.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
    resolvidos: all.filter((t) => DONE.includes(t.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-grena-dark">Chamados</h2>
          <p className="text-sm text-gray-500">Acompanhe e gerencie os chamados</p>
        </div>
        {canCreate && (
          <Link
            to="/tickets/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-grena px-4 py-2 text-sm font-medium text-white shadow-grena transition hover:bg-grena-dark"
          >
            Novo chamado
          </Link>
        )}
      </div>

      {isStaff && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="Em triagem" value={kpis.triagem} />
          <KpiCard label="Abertos" value={kpis.abertos} />
          <KpiCard label="Resolvidos" value={kpis.resolvidos} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-48">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketStatus | '' | 'ACTIVE')}
          >
            <option value="ACTIVE">Em aberto</option>
            <option value="">Todos os status</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {status === 'ACTIVE' ? 'Nenhum chamado em aberto.' : 'Nenhum chamado encontrado.'}
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-grena/5 text-left text-xs uppercase text-grena">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aberto em</th>
                  {isStaff && <th className="px-4 py-3">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((t) => (
                  <tr key={t.id} className="hover:bg-grena/5">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-grena hover:underline" to={`/tickets/${t.id}`}>
                        {t.hasUnread && (
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-grena align-middle" />
                        )}
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {t.slaHours != null ? `até ${t.slaHours}h` : 'Em triagem'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    {isStaff && (
                      <td className="px-4 py-3">
                        <TicketActions
                          ticket={t}
                          isAdmin={isAdmin}
                          staffUsers={staffUsers}
                          currentUserId={user?.id}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="space-y-3 md:hidden">
            {visible.map((t) => (
              <Card key={t.id} className="p-4">
                <Link to={`/tickets/${t.id}`} className="block">
                  <div className="mb-2 font-medium text-gray-900">
                    {t.hasUnread && (
                      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-grena align-middle" />
                    )}
                    {t.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {t.slaHours != null ? `Prazo: até ${t.slaHours}h` : 'Em triagem'}
                    </span>
                    <StatusBadge status={t.status} />
                    <span className="ml-auto text-xs text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </Link>
                {isStaff && (
                  <div className="mt-3">
                    <TicketActions
                      ticket={t}
                      isAdmin={isAdmin}
                      staffUsers={staffUsers}
                      currentUserId={user?.id}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
