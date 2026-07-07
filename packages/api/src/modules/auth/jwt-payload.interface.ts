import { Role } from '@chamados/shared';

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}
