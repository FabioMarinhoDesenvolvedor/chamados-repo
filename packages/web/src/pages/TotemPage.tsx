import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { CategoryWithSubcategories, TicketDetailOption, TicketSubcategory } from '@chamados/shared';
import { useAuth } from '@/auth/auth-context';
import { getToken, setToken } from '@/lib/api';
import { buildBlocks } from '@/lib/blocks';
import { departmentIcon } from '@/lib/department-icon';
import { useCategories } from '@/features/categories/api';
import { useDepartments } from '@/features/departments/api';
import { useCreateTicket } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { CategoryIcon } from '@/components/CategoryIcon';

// Reset automático da tela de confirmação — tempo suficiente para o solicitante ler
// a mensagem antes do próximo usuário do totem começar um novo chamado.
const AUTO_RESET_MS = 8000;

// Card grande (alvo de toque ampliado) para uso em tela cheia no totem.
function KioskCard({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[160px] flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition hover:border-grena hover:bg-grena/5 hover:shadow-grena focus:outline-none focus:ring-4 focus:ring-grena/40 active:scale-[0.98]"
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-grena/10 text-grena">
        <CategoryIcon name={icon} className="h-8 w-8" />
      </span>
      <span className="text-base font-semibold text-gray-800">{label}</span>
    </button>
  );
}

// Provisiona o totem a partir do token na URL (?token=...): grava o token e recarrega
// sem query string, para o auth-context buscar o user kiosk via /users/me (fluxo já
// existente — nenhum endpoint novo).
function useProvisioning(): boolean {
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;
    setProvisioning(true);
    setToken(token);
    window.location.replace(window.location.origin + '/totem');
  }, []);

  return provisioning;
}

export function TotemPage() {
  const provisioning = useProvisioning();
  const { user, loading } = useAuth();

  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useCategories();
  const {
    data: departments,
    isLoading: departmentsLoading,
    isError: departmentsError,
    refetch: refetchDepartments,
  } = useDepartments();
  const createTicket = useCreateTicket();

  const [local, setLocal] = useState('');
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const [block, setBlock] = useState<{ id: number; name: string } | null>(null);
  const [category, setCategory] = useState<CategoryWithSubcategories | null>(null);
  const [subcategory, setSubcategory] = useState<TicketSubcategory | null>(null);
  const [detailOption, setDetailOption] = useState<TicketDetailOption | null>(null);
  const [detailSkipped, setDetailSkipped] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = categoriesLoading || departmentsLoading;
  const isError = categoriesError || departmentsError;
  function refetch() {
    if (categoriesError) refetchCategories();
    if (departmentsError) refetchDepartments();
  }

  // Setor TI é quem opera o totem — não faz sentido abrir chamado contra o próprio setor.
  const blocks = useMemo(
    () => (categories && departments ? buildBlocks(categories, departments, (d) => d.name === 'TI') : []),
    [categories, departments],
  );
  const blockCategories = useMemo(
    () => (block ? (categories ?? []).filter((c) => c.departmentId === block.id) : []),
    [categories, block],
  );

  const subDetails = subcategory?.details ?? [];
  const needsDetail = subDetails.length > 0;
  const showForm = !!subcategory && (!needsDetail || !!detailOption || detailSkipped);

  function resetAll() {
    setLocal('');
    setLocalConfirmed(false);
    setBlock(null);
    setCategory(null);
    setSubcategory(null);
    setDetailOption(null);
    setDetailSkipped(false);
    setDescription('');
    setError('');
    setDone(false);
  }

  // Tela de confirmação volta sozinha ao passo 1 após alguns segundos, ou no toque.
  useEffect(() => {
    if (!done) return;
    resetTimer.current = setTimeout(resetAll, AUTO_RESET_MS);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function backToBlocks() {
    setBlock(null);
    setCategory(null);
    setSubcategory(null);
    setDetailOption(null);
    setDetailSkipped(false);
  }

  function backToCategories() {
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
    if (!user?.departmentId) {
      setError('Totem sem setor configurado — contate a TI.');
      return;
    }
    setError('');
    try {
      await createTicket.mutateAsync({
        categoryId: category.id,
        subcategoryId: subcategory.id,
        detailOptionId: detailOption?.id,
        description: description.trim() || undefined,
        originLocation: local.trim(),
        departmentId: user.departmentId,
      });
      setDone(true);
    } catch {
      setError('Não foi possível abrir o chamado. Tente novamente.');
    }
  }

  // --- Provisionamento / autenticação do kiosk ---
  if (provisioning || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner label="Carregando totem..." />
      </div>
    );
  }
  if (!getToken() || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center">
        <p className="text-lg font-medium text-gray-600">Totem não configurado — contate a TI</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-grena-dark">Abrir chamado</h1>
          <p className="text-sm text-gray-500">Toque para começar</p>
        </div>

        {done ? (
          // Passo 6: confirmação — volta ao passo 1 sozinha ou ao toque.
          <button
            type="button"
            onClick={resetAll}
            className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl bg-white p-16 text-center shadow-grena"
          >
            <CheckCircle2 className="h-20 w-20 text-grena" />
            <p className="text-2xl font-bold text-grena-dark">Chamado registrado, obrigado!</p>
            <p className="text-sm text-gray-500">Toque na tela para abrir outro chamado</p>
          </button>
        ) : !localConfirmed ? (
          // Passo 1: local/sala
          <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-grena">
            <label htmlFor="local" className="block text-base font-semibold text-gray-800">
              Local ou sala
            </label>
            <Input
              id="local"
              autoFocus
              placeholder="Ex.: Sala 12, Recepção..."
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="min-h-[56px] text-lg"
            />
            <Button
              className="w-full min-h-[56px] text-lg"
              disabled={!local.trim()}
              onClick={() => setLocalConfirmed(true)}
            >
              Continuar
            </Button>
          </div>
        ) : isLoading ? (
          <Spinner label="Carregando categorias..." />
        ) : isError ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-grena">
            <p className="text-sm text-gray-600">Não foi possível carregar as categorias.</p>
            <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {/* Trilha (breadcrumb) */}
            <nav className="flex flex-wrap items-center justify-center gap-1 text-sm">
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
                  <span className="font-medium text-gray-800">{subcategory.name}</span>
                </>
              )}
            </nav>

            {!block ? (
              // Passo 2: setor
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {blocks.map((b) => (
                  <KioskCard key={b.id} icon={departmentIcon(b.name)} label={b.name} onClick={() => setBlock(b)} />
                ))}
              </div>
            ) : !category ? (
              // Passo 3: categoria
              <div className="space-y-4">
                <Button variant="ghost" className="px-2" onClick={backToBlocks}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para os setores
                </Button>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {blockCategories.map((c) => (
                    <KioskCard key={c.id} icon={c.icon} label={c.name} onClick={() => setCategory(c)} />
                  ))}
                </div>
              </div>
            ) : !subcategory ? (
              // Passo 3: subcategoria
              <div className="space-y-4">
                <Button variant="ghost" className="px-2" onClick={backToCategories}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para as categorias
                </Button>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {category.subcategories.map((s) => (
                    <KioskCard key={s.id} icon={s.icon} label={s.name} onClick={() => selectSubcategory(s)} />
                  ))}
                </div>
              </div>
            ) : needsDetail && !detailOption && !detailSkipped ? (
              // Passo 3: detalhe (opcional)
              <div className="space-y-4">
                <Button variant="ghost" className="px-2" onClick={() => setSubcategory(null)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para as subcategorias
                </Button>
                <p className="text-center text-sm text-gray-500">
                  O que você observa? <span className="text-gray-400">(opcional)</span>
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {subDetails.map((d) => (
                    <KioskCard key={d.id} icon={d.icon} label={d.name} onClick={() => setDetailOption(d)} />
                  ))}
                  <KioskCard icon="HelpCircle" label="Não sei / Outro" onClick={() => setDetailSkipped(true)} />
                </div>
              </div>
            ) : showForm ? (
              // Passo 4: descrição opcional + concluir
              <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-grena">
                <Button
                  variant="ghost"
                  className="px-2"
                  onClick={() => {
                    if (needsDetail) {
                      setDetailOption(null);
                      setDetailSkipped(false);
                    } else {
                      setSubcategory(null);
                    }
                  }}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>

                <div className="flex items-center gap-3 rounded-md bg-grena/5 p-3">
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
                  <div>
                    <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
                      Descrição (opcional)
                    </label>
                    <Textarea
                      id="description"
                      rows={4}
                      placeholder="Detalhe o problema se quiser."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <Button type="submit" loading={createTicket.isPending} className="w-full min-h-[56px] text-lg">
                    {createTicket.isPending ? 'Enviando...' : 'Concluir'}
                  </Button>
                </form>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
