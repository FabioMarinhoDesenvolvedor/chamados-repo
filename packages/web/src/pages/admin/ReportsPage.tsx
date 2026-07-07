import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { ActivityLogItem, ReportQuery, UserActivityReport } from '@chamados/shared';
import { useUsers } from '@/features/users/api';
import { useCategories } from '@/features/categories/api';
import { useUserActivityReport } from '@/features/reports/api';
import { apiMessage } from '@/lib/api';
import { toast } from '@/lib/toast-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels';

function actionText(item: ActivityLogItem): string {
  if (item.type === 'TICKET_OPENED') return 'Abriu o chamado';
  if (item.type === 'COMMENTED') return 'Comentou';
  const from = item.fromStatus ? STATUS_LABEL[item.fromStatus] : '—';
  const to = item.toStatus ? STATUS_LABEL[item.toStatus] : '—';
  return `Status: ${from} → ${to}`;
}

function fmtDate(date: string | null): string {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
}

// IDs (UUID) são longos: mostra os 8 primeiros como identificador, com o ID completo no title.
const shortId = (id: number) => `#${id}`;

function ReportBody({ report }: { report: UserActivityReport }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-lg font-bold text-grena-dark">Relatório de atividades</h3>
        <p className="text-sm text-gray-600">
          Usuário: <span className="font-medium">{report.user ? report.user.name : 'Todos'}</span>
          {report.user && <span className="text-gray-400"> ({report.user.email})</span>}
        </p>
        <p className="text-sm text-gray-600">
          Período: {fmtDate(report.from)} a {fmtDate(report.to)} · {report.items.length} ação(ões)
        </p>
      </div>

      {report.items.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma atividade no período selecionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-grena/5 text-left text-xs uppercase text-grena">
              <tr>
                <th className="px-3 py-2">ID chamado</th>
                <th className="px-3 py-2">ID usuário</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.items.map((item, idx) => (
                <tr key={idx} className="align-top hover:bg-grena/5">
                  <td className="px-3 py-2">
                    <Link
                      to={`/tickets/${item.ticketId}`}
                      title={String(item.ticketId)}
                      className="font-mono text-grena hover:underline"
                    >
                      {shortId(item.ticketId)}
                    </Link>
                    <div className="text-xs text-gray-400">{item.ticketTitle}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-gray-700" title={String(item.actorId)}>
                      {shortId(item.actorId)}
                    </span>
                    <div className="text-xs text-gray-400">{item.actorName}</div>
                  </td>
                  <td className="px-3 py-2">
                    {item.ticketCategory ? (
                      <>
                        <div className="text-gray-800">{item.ticketCategory}</div>
                        {item.ticketSubcategory && (
                          <div className="text-xs text-gray-400">{item.ticketSubcategory}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {actionText(item)}
                    {item.comment && (
                      <div className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-gray-500">
                        {item.comment}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{STATUS_LABEL[item.ticketStatus]}</td>
                  <td className="px-3 py-2">
                    {item.ticketPriority ? PRIORITY_LABEL[item.ticketPriority] : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {new Date(item.at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportsPage() {
  const { data: users } = useUsers(true);
  const { data: categories } = useCategories();
  const [userId, setUserId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<ReportQuery | null>(null);

  const { data: report, isFetching, isError, error } = useUserActivityReport(
    applied ?? {},
    applied !== null,
  );

  // Feedback ao terminar a geração (relatório é um query, não mutação): dispara
  // o toast uma vez quando a busca conclui.
  const wasFetching = useRef(false);
  useEffect(() => {
    if (wasFetching.current && !isFetching && applied) {
      if (isError) toast.error(apiMessage(error, 'Não foi possível gerar o relatório'));
      else toast.success('Relatório gerado');
    }
    wasFetching.current = isFetching;
  }, [isFetching, isError, error, applied]);

  function onGenerate() {
    setApplied({
      userId: userId ? Number(userId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold text-grena-dark">Relatórios</h2>
        <p className="text-sm text-gray-500">
          Trilha de atividades por ID de chamado/usuário — filtre por usuário, categoria e período
        </p>
      </div>

      <Card className="p-6 print:hidden">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label htmlFor="user">Usuário</Label>
            <Select id="user" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos os usuários</option>
              {users?.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories?.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from">De</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Até</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={onGenerate} loading={isFetching}>
              {isFetching ? 'Gerando...' : 'Gerar relatório'}
            </Button>
          </div>
        </div>
      </Card>

      {report && (
        <Card className="p-6">
          <div className="mb-4 flex justify-end print:hidden">
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
          <ReportBody report={report} />
        </Card>
      )}
    </div>
  );
}
