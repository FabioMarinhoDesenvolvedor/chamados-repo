import { FormEvent, useState } from 'react';
import { KioskTokenResponse } from '@chamados/shared';
import { useDepartments } from '@/features/departments/api';
import { useCreateKioskToken } from '@/features/totem/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiMessage } from '@/lib/api';

// Copia para a área de transferência com fallback quando a Clipboard API não
// está disponível (ex.: contexto não-seguro/http, navegador antigo do totem).
async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // cai para o fallback abaixo
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyToClipboard(value);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={value} className="font-mono text-xs sm:text-sm" />
        <Button type="button" variant="secondary" onClick={onCopy} className="shrink-0">
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
}

export function TotemAdminPage() {
  const { data: departments } = useDepartments();
  const createKioskToken = useCreateKioskToken();
  const [label, setLabel] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<KioskTokenResponse | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      const res = await createKioskToken.mutateAsync({
        label,
        departmentId: Number(departmentId),
      });
      setResult(res);
      setLabel('');
      setDepartmentId('');
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível gerar o token do totem.'));
    }
  }

  const provisioningUrl = result ? `${window.location.origin}/totem?token=${result.token}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Totem</h2>
        <p className="text-sm text-gray-500">
          Gere um token de provisionamento para configurar um dispositivo de totem
        </p>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Novo token de totem</h3>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="label">Identificação (ex.: "Recepção")</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="departmentId">Setor</Label>
            <Select
              id="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecione...
              </option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createKioskToken.isPending}>
              {createKioskToken.isPending ? 'Gerando...' : 'Gerar token'}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
        </form>
      </Card>

      {result && (
        <Card className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-gray-700">Token gerado</h3>

          <CopyField label="Token" value={result.token} />
          <CopyField label="URL de provisionamento" value={provisioningUrl} />

          <div className="space-y-2 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              Abra esta URL uma vez no dispositivo do totem para provisioná-lo. O
              token do totem <strong>{result.user.name}</strong> expira em{' '}
              {result.expiresInDays} dias caso não seja usado.
            </p>
            <p className="font-medium">
              Este token é um segredo: qualquer pessoa com ele pode abrir chamados em nome
              deste totem. Não compartilhe fora do dispositivo destinado. Para revogar o
              acesso, é necessário excluir o usuário do totem (ação futura, ainda não
              disponível nesta tela).
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
