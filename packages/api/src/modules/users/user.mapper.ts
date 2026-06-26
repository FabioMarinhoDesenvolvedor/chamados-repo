import { User } from '@prisma/client';
import { UserPublic } from '@chamados/shared';

export function toUserPublic(u: User): UserPublic {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
