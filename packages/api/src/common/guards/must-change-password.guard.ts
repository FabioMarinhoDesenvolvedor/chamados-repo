import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../decorators/current-user.decorator';
import { SKIP_PASSWORD_CHANGE_CHECK } from '../decorators/skip-password-change-check.decorator';

/**
 * Bloqueia qualquer ação enquanto o usuário tiver `mustChangePassword`, exceto
 * rotas marcadas com @SkipPasswordChangeCheck() (ver o próprio perfil e trocar a
 * senha). Deve rodar depois do JwtAuthGuard (que popula `request.user`).
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_PASSWORD_CHANGE_CHECK, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user?.mustChangePassword) {
      throw new ForbiddenException('Troque sua senha para continuar usando o sistema');
    }
    return true;
  }
}
