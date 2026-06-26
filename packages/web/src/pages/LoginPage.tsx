import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { apiMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'login' | 'first';

export function LoginPage() {
  const { login, firstAccess } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('admin@chamados.local');
  const [password, setPassword] = useState('senha123');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setPassword('');
    setNewPassword('');
    setConfirm('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'first') {
      if (newPassword !== confirm) {
        setError('A confirmação não confere com a nova senha.');
        return;
      }
      if (newPassword.length < 6) {
        setError('A nova senha deve ter ao menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await firstAccess(email, newPassword);
      }
      navigate('/');
    } catch (err) {
      if (mode === 'login') {
        setError('E-mail ou senha inválidos.');
      } else {
        setError(apiMessage(err, 'Não foi possível concluir o primeiro acesso.'));
      }
    } finally {
      setLoading(false);
    }
  }

  const isFirst = mode === 'first';

  return (
    <div className="flex min-h-screen items-center justify-center bg-grena-gradient p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/logo-juventus.png"
            alt="Clube Atlético Juventus"
            className="mb-3 h-20 w-20 object-contain"
          />
          <h1 className="text-lg font-bold text-grena">CHAMADOS</h1>
          <p className="text-sm font-medium text-grena-dark">Clube Atlético Juventus</p>
          <p className="mt-2 text-sm text-gray-500">
            {isFirst ? 'Primeiro acesso: defina sua senha' : 'Acesse com suas credenciais'}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {isFirst ? (
            <>
              <div>
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirmar senha</Label>
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
            </>
          ) : (
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isFirst
                ? 'Definindo...'
                : 'Entrando...'
              : isFirst
                ? 'Definir senha e entrar'
                : 'Entrar'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          {isFirst ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-medium text-grena hover:underline"
            >
              Já tenho senha — fazer login
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode('first')}
              className="font-medium text-grena hover:underline"
            >
              Primeiro acesso? Defina sua senha
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
