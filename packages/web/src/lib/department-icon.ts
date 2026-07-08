// Ícone (lucide) por setor para os cards de macro-bloco. Mapa só de apresentação: os blocos em si
// são data-driven (qualquer setor com categoria aparece). Setor sem entrada cai no fallback.
const DEPARTMENT_ICON: Record<string, string> = {
  TI: 'Laptop',
  Manutenção: 'Wrench',
  Limpeza: 'Sparkles',
};

export function departmentIcon(name: string): string {
  return DEPARTMENT_ICON[name] ?? 'Building2';
}
