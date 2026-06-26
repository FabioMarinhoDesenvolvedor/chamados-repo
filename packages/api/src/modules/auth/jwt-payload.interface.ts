import { Role } from '@chamados/shared';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
