import { Role } from './enums';

// "Staff" = equipe de atendimento (ADMIN ou OPERATOR): vê todos os chamados e os
// trabalha. Fonte única (DRY) para back e front — evita repetir a comparação por papel.
export function isStaffRole(role: Role): boolean {
  return role === 'ADMIN' || role === 'OPERATOR';
}
