import { FormEvent, useState } from 'react';
import { Role, ROLES, TEMP_PASSWORD_MIN_LENGTH, UserPublic } from '@chamados/shared';
import { useAuth } from '@/auth/auth-context';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/features/users/api';
import { useDepartments } from '@/features/departments/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ROLE_LABEL } from '@/lib/labels';
import { apiMessage } from '@/lib/api';

interface FormState {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId: string;
}

const EMPTY: FormState = { name: '', email: '', password: '', role: 'USER', departmentId: '' };

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users } = useUsers();
  const { data: departments } = useDepartments();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<FormState>(EMPTY);
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  async function onDelete(u: UserPublic) {
    setDeleteError('');
    if (!window.confirm(`Excluir o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteUser.mutateAsync(u.id);
      if (editingId === u.id) setEditingId(null);
    } catch (err) {
      setDeleteError(apiMessage(err, 'Não foi possível excluir o usuário.'));
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function updateEdit<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEdit((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(u: UserPublic) {
    setEditingId(u.id);
    setEditError('');
    setEdit({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      departmentId: u.departmentId ?? '',
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createUser.mutateAsync({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        departmentId: form.departmentId || null,
      });
      setForm(EMPTY);
    } catch {
      setError('Não foi possível criar o usuário (e-mail já cadastrado?).');
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError('');
    try {
      await updateUser.mutateAsync({
        id: editingId,
        input: {
          name: edit.name,
          email: edit.email,
          role: edit.role,
          departmentId: edit.departmentId || null,
          ...(edit.password ? { password: edit.password } : {}),
        },
      });
      setEditingId(null);
    } catch {
      setEditError('Não foi possível salvar (e-mail já cadastrado?).');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">Usuários</h2>
        <p className="text-sm text-gray-500">Controle total: edite dados, perfil e redefina senha</p>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-grena">Novo usuário</h3>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
              minLength={TEMP_PASSWORD_MIN_LENGTH}
            />
          </div>
          <div>
            <Label htmlFor="role">Perfil</Label>
            <Select id="role" value={form.role} onChange={(e) => update('role', e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="department">Departamento</Label>
            <Select
              id="department"
              value={form.departmentId}
              onChange={(e) => update('departmentId', e.target.value)}
            >
              <option value="">Sem departamento</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={createUser.isPending}>
              {createUser.isPending ? 'Salvando...' : 'Criar usuário'}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-grena/5 text-left text-xs uppercase text-grena">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-0 px-3 py-1 text-xs"
                      onClick={() => startEdit(u)}
                    >
                      Editar
                    </Button>
                    {u.id !== currentUser?.id && (
                      <Button
                        variant="secondary"
                        className="min-h-0 border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        disabled={deleteUser.isPending}
                        onClick={() => onDelete(u)}
                      >
                        Excluir
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deleteError && <p className="px-4 py-3 text-sm text-red-600">{deleteError}</p>}
      </Card>

      {editingId && (
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-grena">Editar usuário</h3>
          <form onSubmit={onSaveEdit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={edit.name} onChange={(e) => updateEdit('name', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={edit.email}
                onChange={(e) => updateEdit('email', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-password">Nova senha</Label>
              <Input
                id="edit-password"
                type="password"
                value={edit.password}
                onChange={(e) => updateEdit('password', e.target.value)}
                placeholder="Deixe em branco para manter"
                minLength={TEMP_PASSWORD_MIN_LENGTH}
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Perfil</Label>
              <Select
                id="edit-role"
                value={edit.role}
                onChange={(e) => updateEdit('role', e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-department">Departamento</Label>
              <Select
                id="edit-department"
                value={edit.departmentId}
                onChange={(e) => updateEdit('departmentId', e.target.value)}
              >
                <option value="">Sem departamento</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <Button type="submit" loading={updateUser.isPending}>
                {updateUser.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
            </div>
            {editError && <p className="text-sm text-red-600 sm:col-span-2">{editError}</p>}
          </form>
        </Card>
      )}
    </div>
  );
}
