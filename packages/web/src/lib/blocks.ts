import { CategoryWithSubcategories, Department } from '@chamados/shared';

// Blocos de setor = setores executores que têm ao menos uma categoria. Data-driven.
// `exclude` permite que um fluxo (ex.: totem) esconda um setor específico (ex.: TI,
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
    .filter((d) => withDept.has(d.id) && !(exclude?.(d) ?? false))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name }));
}
