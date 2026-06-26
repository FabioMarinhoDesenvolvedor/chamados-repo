import { useState } from 'react';
import { Database, Download, Clock } from 'lucide-react';
import { useBackups, useRunBackup } from '@/features/backup/api';
import { apiMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupPage() {
  const { data, isLoading } = useBackups();
  const runBackup = useRunBackup();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onRun() {
    setMessage('');
    setError('');
    try {
      const res = await runBackup.mutateAsync();
      setMessage(`Backup gerado: ${res.filename} (${formatSize(res.size)}).`);
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível gerar o backup.'));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">Backup do banco</h2>
        <p className="text-sm text-gray-500">
          Cópia completa do banco (dump SQL comprimido .sql.gz) para recuperação
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-grena" />
            <div className="text-sm text-gray-700">
              <p className="font-medium">Backup automático às 02:00 (todos os dias)</p>
              <p className="text-gray-500">
                Mantém os últimos backups e remove os mais antigos. Requer o servidor da API ligado
                no horário.
              </p>
            </div>
          </div>
          <Button onClick={onRun} disabled={runBackup.isPending}>
            <Database className="mr-2 h-4 w-4" />
            {runBackup.isPending ? 'Gerando...' : 'Backup agora'}
          </Button>
        </div>
        {message && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold text-grena">Local de armazenamento</h3>
        <p className="break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-700">
          {data?.directory ?? '—'}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Para ficar fora do servidor, aponte a variável <code>BACKUP_DIR</code> para um drive de
          rede, disco externo ou pasta sincronizada.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-grena">
          Backups disponíveis
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Carregando...</p>
        ) : !data || data.items.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Nenhum backup ainda. Clique em “Backup agora” para gerar o primeiro.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-grena/5 text-left text-xs uppercase text-grena">
              <tr>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Tamanho</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((b) => (
                <tr key={b.filename}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    <Download className="mr-1 inline h-3 w-3 text-gray-400" />
                    {b.filename}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(b.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatSize(b.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold text-grena">Como restaurar</h3>
        <p className="mb-2 text-sm text-gray-600">
          O arquivo <code>.sql.gz</code> é um dump SQL completo. Para recuperar o banco:
        </p>
        <pre className="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
          gunzip -c chamados-AAAA-MM-DD.sql.gz | psql &quot;&lt;DATABASE_URL&gt;&quot;
        </pre>
      </Card>
    </div>
  );
}
