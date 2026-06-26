import { FormEvent, useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { useUnlockVault, useVaultStatus } from '@/features/vault/api';
import { apiMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function VaultBanner({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useVaultStatus();
  const unlock = useUnlockVault();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const status = data?.status;
  if (!status || status === 'UNLOCKED') return null;

  const first = status === 'UNINITIALIZED';

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await unlock.mutateAsync(password);
      setPassword('');
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível desbloquear o cofre.'));
    }
  }

  if (!isAdmin) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
        <Lock className="h-4 w-4 shrink-0" />
        Anexos de imagem temporariamente indisponíveis (cofre bloqueado). A TI precisa liberar o acesso.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 print:hidden">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert className="h-4 w-4" />
        {first
          ? 'Cofre de anexos: defina a senha-mestra (primeiro uso)'
          : 'Cofre de anexos bloqueado — desbloqueie para ver e anexar imagens'}
      </div>
      <p className="mb-3 text-xs">
        A senha-mestra criptografa as imagens e não fica salva. Será necessária novamente após cada
        reinício do servidor. {first && 'Guarde-a com cuidado: sem ela, os anexos não podem ser abertos.'}
      </p>
      <form onSubmit={onUnlock} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="password"
          placeholder={first ? 'Crie a senha-mestra (mín. 8)' : 'Senha-mestra'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          className="sm:max-w-xs"
          autoComplete="off"
        />
        <Button type="submit" disabled={unlock.isPending}>
          {unlock.isPending ? 'Processando...' : first ? 'Definir e desbloquear' : 'Desbloquear'}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
