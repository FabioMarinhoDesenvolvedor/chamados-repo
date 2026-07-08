import { CategoryWithSubcategories, Department } from '@chamados/shared';

// Setores "ESTACIONADOS": existem no sistema (departamento + categorias cadastradas), mas
// AINDA NÃO aparecem no fluxo de abertura de chamado nem no totem. Ficam guardados para o
// Fabio liberar quando quiser. >>> PARA LIBERAR UM SETOR, REMOVA O NOME DESTA LISTA <<<
// (decisão 2026-07-08: TI é o core e volta ao fluxo; Manutenção/Limpeza ficam de lado por ora.)
export const PARKED_DEPARTMENTS = ['Manutenção', 'Limpeza'];

// Blocos de setor = setores executores que têm ao menos uma categoria e NÃO estão estacionados.
// Data-driven. `exclude` permite que um fluxo (ex.: totem) esconda um setor específico (ex.: TI,
// que atende o próprio totem e não deveria abrir chamado contra si mesmo).
export function buildBlocks(
  categories: CategoryWithSubcategories[],
  departments: Department[],
  exclude?: (d: Department) => boolean,
): { id: number; name: string }[] {
  const withDept = new Set(
    categories.map((c) => c.departmentId).filter((d): d is number => d != null),
  );
  return departments
    .filter(
      (d) =>
        withDept.has(d.id) &&
        !PARKED_DEPARTMENTS.includes(d.name) &&
        !(exclude?.(d) ?? false),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name }));
}
