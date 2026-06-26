import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponse } from '@chamados/shared';
import { UsersService } from '../users/users.service';
import { toUserPublic } from '../users/user.mapper';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { token, user: toUserPublic(user) };
  }

  // Primeiro acesso: identifica pelo e-mail; só funciona enquanto o usuário ainda
  // não trocou a senha (mustChangePassword). Define a senha e já autentica.
  async firstAccess(email: string, newPassword: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.mustChangePassword) {
      throw new UnauthorizedException(
        'E-mail não encontrado ou primeiro acesso já realizado. Faça login normalmente.',
      );
    }

    const updated = await this.users.completeFirstAccess(user.id, newPassword);
    const payload: JwtPayload = { sub: updated.id, email: updated.email, role: updated.role };
    const token = await this.jwt.signAsync(payload);
    return { token, user: toUserPublic(updated) };
  }
}
