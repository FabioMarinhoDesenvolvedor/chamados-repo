import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { api, apiMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const forced = user?.mustChangePassword ?? false;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users/me/password', { currentPassword, newPassword });
      await refreshUser();
      setDone(true);
      if (forced) {
        navigate('/');
      }
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível alterar a senha.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">Trocar senha</h2>
        {forced ? (
          <p className="text-sm text-red-600">
            Por segurança, defina uma nova senha para continuar usando o sistema.
          </p>
        ) : (
          <p className="text-sm text-gray-500">Defina uma nova senha de acesso.</p>
        )}
      </div>

      <Card className="p-6">
        {done && !forced && (
          <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            Senha alterada com sucesso.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="current">Senha atual</Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="new">Nova senha</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
            {!forced && (
              <Button type="button" variant="secondary" onClick={() => navigate('/')}>
                Voltar
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
