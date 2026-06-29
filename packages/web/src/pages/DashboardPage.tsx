import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Priority, PRIORITIES, Ticket, TicketStatus, TICKET_STATUSES } from '@chamados/shared';
import { useAuth } from '@/auth/auth-context';
import { useTickets, useUpdateStatus } from '@/features/tickets/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { PriorityBarChart } from '@/components/PriorityBarChart';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels';
import { slaText } from '@/lib/sla';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

function ConcludeButton({ ticket }: { ticket: Ticket }) {
  const updateStatus = useUpdateStatus(ticket.id);
  if (DONE.includes(ticket.status)) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <Button
      variant="secondary"
      className="min-h-0 px-2 py-1 text-xs"
      disabled={updateStatus.isPending}
      onClick={(e) => {
        e.preventDefault();
        updateStatus.mutate({ status: 'RESOLVED' });
      }}
    >
      <Check className="mr-1 h-4 w-4" /> Resolver
    </Button>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const { data: tickets, isLoading } = useTickets({
    status: status || undefined,
    priority: priority || undefined,
  });

  const all = tickets ?? [];
  const kpis = {
    triagem: all.filter((t) => t.status === 'TRIAGE').length,
    abertos: all.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
    urgentes: all.filter((t) => t.priority === 'URGENT').length,
    resolvidos: all.filter((t) => DONE.includes(t.status)).length,
  };
  const counts = PRIORITIES.reduce(
    (acc, p) => ({ ...acc, [p]: all.filter((t) => t.priority === p).length }),
    {} as Record<Priority, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-grena-dark">Chamados</h2>
          <p className="text-sm text-gray-500">Acompanhe e gerencie os chamados</p>
        </div>
        <Link
          to="/tickets/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-grena px-4 py-2 text-sm font-medium text-white shadow-grena transition hover:bg-grena-dark"
        >
          Novo chamado
        </Link>
      </div>

      {isAdmin && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Em triagem" value={kpis.triagem} />
            <KpiCard label="Abertos" value={kpis.abertos} />
            <KpiCard label="Urgentes" value={kpis.urgentes} highlight />
            <KpiCard label="Resolvidos" value={kpis.resolvidos} />
          </div>
          <PriorityBarChart counts={counts} />
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')}>
            <option value="">Todos os status</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        {isAdmin && (
          <div className="sm:w-48">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
              <option value="">Todas as prioridades</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : all.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">Nenhum chamado encontrado.</Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-grena/5 text-left text-xs uppercase text-grena">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">{isAdmin ? 'Prioridade' : 'Prazo'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aberto em</th>
                  {isAdmin && <th className="px-4 py-3">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {all.map((t) => (
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
                      {isAdmin ? (
                        <PriorityBadge priority={t.priority} />
                      ) : (
                        <span className="text-xs text-gray-500">
                          {t.slaHours != null ? `até ${t.slaHours}h` : 'Em triagem'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <ConcludeButton ticket={t} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="space-y-3 md:hidden">
            {all.map((t) => (
              <Card key={t.id} className="p-4">
                <Link to={`/tickets/${t.id}`} className="block">
                  <div className="mb-2 font-medium text-gray-900">
                    {t.hasUnread && (
                      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-grena align-middle" />
                    )}
                    {t.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin ? (
                      <PriorityBadge priority={t.priority} />
                    ) : (
                      <span className="text-xs text-gray-500">
                        {t.slaHours != null ? `Prazo: até ${t.slaHours}h` : 'Em triagem'}
                      </span>
                    )}
                    <StatusBadge status={t.status} />
                    <span className="ml-auto text-xs text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </Link>
                {isAdmin && (
                  <div className="mt-3">
                    <ConcludeButton ticket={t} />
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
