import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@chamados/shared';

export interface AuthUser {
  userId: number;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  departmentId: number | null;
  isKiosk: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user as AuthUser;
  },
);
