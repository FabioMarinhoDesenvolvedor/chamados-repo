import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../jwt-payload.interface';
import { getJwtSecret } from '../jwt-secret';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  // Carrega o usuário a cada requisição: garante que ele ainda existe (token de
  // usuário excluído deixa de valer) e expõe o flag mustChangePassword atualizado.
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Sessão inválida');
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      isKiosk: user.isKiosk,
    };
  }
}
