import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { useDepartments } from '@/features/departments/api';
import { useUsers } from '@/features/users/api';
import { useCreateTicket, useUploadAttachments } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentInput } from '@/components/AttachmentInput';

export function NewTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: departments } = useDepartments();
  const isAdmin = user?.role === 'ADMIN';
  // OPERATOR não abre chamados (só atende) — bloqueia o acesso direto à rota.
  const blockOperator = user?.role === 'OPERATOR';
  const { data: users } = useUsers(isAdmin);
  const createTicket = useCreateTicket();
  const uploadAttachments = useUploadAttachments();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [requesterId, setRequesterId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const userDeptName =
    departments?.find((d) => d.id === user?.departmentId)?.name ?? '';
  const userHasNoDept = !isAdmin && !user?.departmentId;

  // ADMIN: ao escolher o solicitante, já sugere o setor dele (continua editável).
  function onSelectRequester(id: string) {
    setRequesterId(id);
    const requester = users?.find((u) => u.id === id);
    if (requester?.departmentId) setDepartmentId(requester.departmentId);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    // USER sempre usa o próprio setor (o backend também força isso).
    const dept = isAdmin ? departmentId : user?.departmentId ?? '';
    try {
      const ticket = await createTicket.mutateAsync({
        title,
        description,
        departmentId: dept,
        requesterId: isAdmin && requesterId ? requesterId : undefined,
      });
      if (files.length > 0) {
        await uploadAttachments.mutateAsync({ ticketId: ticket.id, files });
      }
      navigate(`/tickets/${ticket.id}`);
    } catch {
      setError('Não foi possível abrir o chamado. Verifique os dados.');
    }
  }

  const submitting = createTicket.isPending || uploadAttachments.isPending;

  if (blockOperator) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">Novo chamado</h2>
        <p className="text-sm text-gray-500">Descreva o problema com clareza</p>
      </div>
      <Card className="p-6">
        {userHasNoDept ? (
          <p className="text-sm text-red-600">
            Seu usuário não tem setor cadastrado. Contate a equipe de TI para abrir chamados.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
              />
            </div>
            {isAdmin && (
              <div>
                <Label htmlFor="requester">Solicitante</Label>
                <Select
                  id="requester"
                  value={requesterId}
                  onChange={(e) => onSelectRequester(e.target.value)}
                >
                  <option value="">Eu mesmo (admin)</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Abra em nome de outro usuário quando ele não conseguir abrir sozinho.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="department">Setor</Label>
              {isAdmin ? (
                <Select
                  id="department"
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
              ) : (
                <Input id="department" value={userDeptName} readOnly disabled />
              )}
              {!isAdmin && (
                <p className="mt-1 text-xs text-gray-500">O chamado é aberto no seu setor.</p>
              )}
            </div>
            <div>
              <Label>Imagens / prints (opcional)</Label>
              <AttachmentInput files={files} onChange={setFiles} disabled={submitting} />
            </div>
            <p className="text-xs text-gray-500">
              A complexidade e a prioridade serão definidas pela equipe de TI na triagem.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Abrindo...' : 'Abrir chamado'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/')}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
