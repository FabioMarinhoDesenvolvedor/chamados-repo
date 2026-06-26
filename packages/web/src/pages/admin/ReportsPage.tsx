import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { ActivityLogItem, ReportQuery, UserActivityReport } from '@chamados/shared';
import { useUsers } from '@/features/users/api';
import { useUserActivityReport } from '@/features/reports/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AttachmentThumb } from '@/components/AttachmentThumb';
import { STATUS_LABEL } from '@/lib/labels';

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  const label = new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function actionText(item: ActivityLogItem): string {
  if (item.type === 'TICKET_OPENED') return 'Abriu o chamado';
  if (item.type === 'COMMENTED') return 'Comentou';
  const from = item.fromStatus ? STATUS_LABEL[item.fromStatus] : '—';
  const to = item.toStatus ? STATUS_LABEL[item.toStatus] : '—';
  return `Status: ${from} → ${to}`;
}

function groupByMonth(items: ActivityLogItem[]) {
  const groups: { key: string; label: string; items: ActivityLogItem[] }[] = [];
  for (const item of items) {
    const key = monthKey(item.at);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: monthLabel(item.at), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function fmtDate(date: string | null): string {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
}

function ReportBody({ report }: { report: UserActivityReport }) {
  const groups = useMemo(() => groupByMonth(report.items), [report.items]);
  const showActor = report.user === null; // "Todos" → identifica quem fez

  return (
    <div className="space-y-6">
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
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wide text-grena">{group.label}</h4>
            <ol className="space-y-3 border-l-2 border-grena/20 pl-4">
              {group.items.map((item, idx) => (
                <li key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-grena" />
                  <div className="text-xs text-gray-500">
                    {new Date(item.at).toLocaleString('pt-BR')}
                    {showActor && <span className="ml-2 font-medium text-gray-700">{item.actorName}</span>}
                  </div>
                  <div className="text-sm text-gray-800">
                    {actionText(item)} —{' '}
                    <Link to={`/tickets/${item.ticketId}`} className="font-medium text-grena hover:underline">
                      {item.ticketTitle}
                    </Link>
                  </div>
                  {item.comment && (
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-grena/5 p-2 text-sm text-gray-700">
                      {item.comment}
                    </p>
                  )}
                  {item.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.attachments.map((a, i) => (
                        <AttachmentThumb key={i} url={a.url} alt={a.originalName} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

export function ReportsPage() {
  const { data: users } = useUsers(true);
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<ReportQuery | null>(null);

  const { data: report, isFetching } = useUserActivityReport(applied ?? {}, applied !== null);

  function onGenerate() {
    setApplied({
      userId: userId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold text-grena-dark">Relatórios</h2>
        <p className="text-sm text-gray-500">
          Trilha de atividades por usuário — escolha o usuário e o período, agrupado por mês
        </p>
      </div>

      <Card className="p-6 print:hidden">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="user">Usuário</Label>
            <Select id="user" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos os usuários</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
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
            <Button type="button" onClick={onGenerate} disabled={isFetching}>
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
