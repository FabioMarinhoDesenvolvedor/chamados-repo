import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import {
  CategoryWithSubcategories,
  Department,
  TicketDetailOption,
  TicketSubcategory,
} from '@chamados/shared';
import { useAuth } from '@/auth/auth-context';
import { useDepartments } from '@/features/departments/api';
import { useUsers } from '@/features/users/api';
import { useCategories } from '@/features/categories/api';
import { useCreateTicket, useUploadAttachments } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { CategoryIcon } from '@/components/CategoryIcon';
import { AttachmentInput } from '@/components/AttachmentInput';
import { departmentIcon } from '@/lib/department-icon';

// Blocos de setor = setores executores que têm ao menos uma categoria. Data-driven.
function buildBlocks(
  categories: CategoryWithSubcategories[],
  departments: Department[],
): { id: number; name: string }[] {
  const withDept = new Set(
    categories.map((c) => c.departmentId).filter((d): d is number => d != null),
  );
  return departments
    .filter((d) => withDept.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name }));
}

// Card de bloco/sub-bloco: ícone (lucide) + rótulo, layout idêntico entre todos.
function BlockCard({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm transition hover:border-grena hover:bg-grena/5 hover:shadow-grena focus:outline-none focus:ring-2 focus:ring-grena/40"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-grena/10 text-grena">
        <CategoryIcon name={icon} className="h-6 w-6" />
      </span>
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </button>
  );
}

export function NewTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  // OPERATOR não abre chamados (só atende) — bloqueia o acesso direto à rota.
  const blockOperator = user?.role === 'OPERATOR';

  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useCategories();
  const {
    data: departments,
    isLoading: departmentsLoading,
    isError: departmentsError,
    refetch: refetchDepartments,
  } = useDepartments();
  const { data: users } = useUsers(isAdmin);
  const createTicket = useCreateTicket();
  const uploadAttachments = useUploadAttachments();

  const [block, setBlock] = useState<{ id: number; name: string } | null>(null);
  const [category, setCategory] = useState<CategoryWithSubcategories | null>(null);
  const [subcategory, setSubcategory] = useState<TicketSubcategory | null>(null);
  const [detailOption, setDetailOption] = useState<TicketDetailOption | null>(null);
  // Detalhe é opcional: o usuário pode pular com "Não sei / Outro".
  const [detailSkipped, setDetailSkipped] = useState(false);
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [requesterId, setRequesterId] = useState<number | ''>('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  // Passo 0 depende de categorias E setores — qualquer um carregando/errando bloqueia o passo.
  const isLoading = categoriesLoading || departmentsLoading;
  const isError = categoriesError || departmentsError;
  function refetch() {
    if (categoriesError) refetchCategories();
    if (departmentsError) refetchDepartments();
  }

  const blocks = useMemo(
    () => (categories && departments ? buildBlocks(categories, departments) : []),
    [categories, departments],
  );
  const blockCategories = useMemo(
    () => (block ? (categories ?? []).filter((c) => c.departmentId === block.id) : []),
    [categories, block],
  );

  const userDeptName = departments?.find((d) => d.id === user?.departmentId)?.name ?? '';
  const userHasNoDept = !isAdmin && !user?.departmentId;
  const submitting = createTicket.isPending || uploadAttachments.isPending;

  const subDetails = subcategory?.details ?? [];
  const needsDetail = subDetails.length > 0;
  // Detalhe é OPCIONAL: mostra o form quando a subcategoria não tem detalhes, OU já se
  // escolheu um, OU o usuário pulou ("Não sei / Outro").
  const showForm = !!subcategory && (!needsDetail || !!detailOption || detailSkipped);

  if (blockOperator) return <Navigate to="/" replace />;

  // ADMIN: ao escolher o solicitante, sugere o setor dele (continua editável).
  function onSelectRequester(id: number | '') {
    setRequesterId(id);
    const requester = users?.find((u) => u.id === id);
    if (requester?.departmentId) setDepartmentId(requester.departmentId);
  }

  function backToCategories() {
    setCategory(null);
    setSubcategory(null);
    setDetailOption(null);
    setDetailSkipped(false);
  }

  function backToBlocks() {
    setBlock(null);
    setCategory(null);
    setSubcategory(null);
    setDetailOption(null);
    setDetailSkipped(false);
  }

  function selectSubcategory(s: TicketSubcategory) {
    setSubcategory(s);
    setDetailOption(null);
    setDetailSkipped(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!category || !subcategory) return;
    setError('');
    // USER sempre usa o próprio setor (o backend também força isso).
    const dept = isAdmin ? departmentId : user?.departmentId ?? '';
    if (!dept) {
      setError('Selecione um setor para abrir o chamado.');
      return;
    }
    try {
      const ticket = await createTicket.mutateAsync({
        categoryId: category.id,
        subcategoryId: subcategory.id,
        detailOptionId: detailOption?.id,
        description: description.trim() || undefined,
        departmentId: dept,
        requesterId: isAdmin && requesterId ? requesterId : undefined,
      });
      if (files.length > 0) {
        await uploadAttachments.mutateAsync({ ticketId: ticket.id, files });
      }
      navigate(`/tickets/${ticket.id}`);
    } catch {
      setError('Não foi possível abrir o chamado. Tente novamente.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">Novo chamado</h2>
        <p className="text-sm text-gray-500">Escolha a categoria que melhor descreve o problema</p>
      </div>

      {/* Trilha (breadcrumb): mantém o contexto do bloco selecionado. */}
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={backToBlocks}
          className={block ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
        >
          Setor
        </button>
        {block && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <button
              type="button"
              onClick={backToCategories}
              className={category ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
            >
              {block.name}
            </button>
          </>
        )}
        {category && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <button
              type="button"
              onClick={() => { setSubcategory(null); setDetailOption(null); setDetailSkipped(false); }}
              className={subcategory ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
            >
              {category.name}
            </button>
          </>
        )}
        {subcategory && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <button
              type="button"
              onClick={() => { setDetailOption(null); setDetailSkipped(false); }}
              className={detailOption ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
            >
              {subcategory.name}
            </button>
          </>
        )}
        {detailOption && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-800">{detailOption.name}</span>
          </>
        )}
      </nav>

      {userHasNoDept ? (
        <Card className="p-6">
          <p className="text-sm text-red-600">
            Seu usuário não tem setor cadastrado. Contate a equipe de TI para abrir chamados.
          </p>
        </Card>
      ) : isLoading ? (
        <Spinner label="Carregando categorias..." />
      ) : isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-600">Não foi possível carregar as categorias.</p>
          <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </Card>
      ) : !block ? (
        // Passo 0: macro-bloco (setor) — data-driven
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b) => (
            <BlockCard key={b.id} icon={departmentIcon(b.name)} label={b.name} onClick={() => setBlock(b)} />
          ))}
        </div>
      ) : !category ? (
        // Passo 1: categorias do setor escolhido
        <div className="space-y-4">
          <Button variant="ghost" className="px-2" onClick={backToBlocks}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para os setores
          </Button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {blockCategories.map((c) => (
              <BlockCard key={c.id} icon={c.icon} label={c.name} onClick={() => setCategory(c)} />
            ))}
          </div>
        </div>
      ) : !subcategory ? (
        // Passo 2: subcategorias do bloco
        <div className="space-y-4">
          <Button variant="ghost" className="px-2" onClick={backToCategories}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para as categorias
          </Button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.subcategories.map((s) => (
              <BlockCard key={s.id} icon={s.icon} label={s.name} onClick={() => selectSubcategory(s)} />
            ))}
          </div>
        </div>
      ) : needsDetail && !detailOption && !detailSkipped ? (
        // Passo 3: detalhes (3º nível) — OPCIONAL. "Não sei / Outro" pula direto pro form.
        <div className="space-y-4">
          <Button variant="ghost" className="px-2" onClick={() => setSubcategory(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para as subcategorias
          </Button>
          <p className="text-sm text-gray-500">
            O que você observa?{' '}
            <span className="text-gray-400">(opcional — se não souber, toque em "Não sei / Outro")</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subDetails.map((d) => (
              <BlockCard key={d.id} icon={d.icon} label={d.name} onClick={() => setDetailOption(d)} />
            ))}
            <BlockCard icon="HelpCircle" label="Não sei / Outro" onClick={() => setDetailSkipped(true)} />
          </div>
        </div>
      ) : showForm ? (
        // Passo 4: form (descrição opcional + anexos) — inalterado
        <Card className="p-6">
          <Button
            variant="ghost"
            className="mb-4 px-2"
            onClick={() => {
              if (needsDetail) {
                setDetailOption(null);
                setDetailSkipped(false);
              } else {
                setSubcategory(null);
              }
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> {needsDetail ? 'Voltar' : 'Trocar subcategoria'}
          </Button>

          <div className="mb-5 flex items-center gap-3 rounded-md bg-grena/5 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grena/10 text-grena">
              <CategoryIcon name={detailOption?.icon ?? subcategory.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-gray-500">
                {category.name} › {subcategory.name}
              </p>
              <p className="text-sm font-semibold text-grena-dark">
                {detailOption ? detailOption.name : subcategory.name}
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {isAdmin && (
              <>
                <div>
                  <Label htmlFor="requester">Solicitante</Label>
                  <Select
                    id="requester"
                    value={requesterId}
                    onChange={(e) => onSelectRequester(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Eu mesmo (admin)</option>
                    {users?.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="department">Setor</Label>
                  <Select
                    id="department"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {departments?.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}
            {!isAdmin && (
              <p className="text-xs text-gray-500">
                Setor: <span className="font-medium">{userDeptName}</span>
              </p>
            )}

            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="Detalhe o problema se quiser — a categoria já identifica o tipo de chamado."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Label>Imagens / prints (opcional)</Label>
              <AttachmentInput files={files} onChange={setFiles} disabled={submitting} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {submitting ? 'Abrindo...' : 'Concluir chamado'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/')}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
