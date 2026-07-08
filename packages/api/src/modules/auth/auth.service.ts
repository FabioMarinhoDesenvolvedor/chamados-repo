import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponse, KioskTokenResponse } from '@chamados/shared';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { toUserPublic } from '../users/user.mapper';
import { DepartmentsRepository } from '../departments/departments.repository';
import { JwtPayload } from './jwt-payload.interface';
import { CreateKioskTokenDto } from './dto/create-kiosk-token.dto';

// Tempo de vida do token do totem: dispositivo fixo, sem login manual — o token
// dura ~1 ano em vez do padrão curto usado para usuários humanos.
const KIOSK_TOKEN_EXPIRES_IN = '365d';
const KIOSK_TOKEN_EXPIRES_IN_DAYS = 365;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly usersRepo: UsersRepository,
    private readonly departments: DepartmentsRepository,
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

  // Deriva um e-mail estável a partir do label (ex.: "Totem Portaria" -> "totem-portaria")
  // para que reemitir o token do mesmo totem faça upsert em vez de criar duplicata.
  private slugify(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Emite um JWT de vida longa para um dispositivo totem (kiosk): não há login manual,
  // então o usuário kiosk nunca autentica por senha (hash aleatório inutilizável).
  async issueKioskToken(dto: CreateKioskTokenDto): Promise<KioskTokenResponse> {
    const department = await this.departments.findById(dto.departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    const slug = this.slugify(dto.label);
    const email = `totem-${slug}@kiosk.local`;

    const randomHash = await bcrypt.hash(randomUUID(), 10);
    const user = await this.usersRepo.upsertKiosk({
      email,
      name: dto.label.trim(),
      departmentId: dto.departmentId,
      passwordHash: randomHash,
    });

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwt.signAsync(payload, { expiresIn: KIOSK_TOKEN_EXPIRES_IN });
    return { token, user: toUserPublic(user), expiresInDays: KIOSK_TOKEN_EXPIRES_IN_DAYS };
  }
}
