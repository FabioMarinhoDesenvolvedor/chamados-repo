import { FormEvent, useState } from 'react';
import { Department } from '@chamados/shared';
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
} from '@/features/departments/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiMessage } from '@/lib/api';

export function DepartmentsPage() {
  const { data: departments } = useDepartments();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const [name, setName] = useState('');
  const [priorityWeight, setPriorityWeight] = useState(3);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  async function onDelete(d: Department) {
    setDeleteError('');
    if (!window.confirm(`Excluir o departamento "${d.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await deleteDepartment.mutateAsync(d.id);
    } catch (err) {
      setDeleteError(apiMessage(err, 'Não foi possível excluir o departamento.'));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createDepartment.mutateAsync({ name, priorityWeight });
      setName('');
      setPriorityWeight(3);
    } catch {
      setError('Não foi possível criar o departamento (nome já existe?).');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Departamentos</h2>
        <p className="text-sm text-gray-500">
          O peso (1 a 5) influencia o cálculo de prioridade dos chamados
        </p>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Novo departamento</h3>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="weight">Peso de prioridade (1-5)</Label>
            <Input
              id="weight"
              type="number"
              min={1}
              max={5}
              value={priorityWeight}
              onChange={(e) => setPriorityWeight(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createDepartment.isPending}>
              {createDepartment.isPending ? 'Salvando...' : 'Criar departamento'}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Peso</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {departments?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.priorityWeight}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="secondary"
                    className="min-h-0 border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                    disabled={deleteDepartment.isPending}
                    onClick={() => onDelete(d)}
                  >
                    Excluir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deleteError && <p className="px-4 py-3 text-sm text-red-600">{deleteError}</p>}
      </Card>
    </div>
  );
}
