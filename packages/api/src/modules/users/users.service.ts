import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserPublic } from './user.mapper';
import { BCRYPT_ROUNDS } from './users.constants';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  async findOnePublic(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toUserPublic(user);
  }

  async list() {
    const users = await this.repo.findAll();
    return users.map(toUserPublic);
  }

  async create(dto: CreateUserDto) {
    const exists = await this.repo.findByEmail(dto.email);
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.repo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      department: dto.departmentId ? { connect: { id: dto.departmentId } } : undefined,
    });
    return toUserPublic(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dto.email && dto.email !== user.email) {
      const exists = await this.repo.findByEmail(dto.email);
      if (exists) throw new ConflictException('E-mail já cadastrado');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) {
      // Reset de senha pelo admin = senha temporária; usuário troca no próximo acesso.
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      data.mustChangePassword = true;
    }
    if (dto.departmentId !== undefined) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    const updated = await this.repo.update(id, data);
    return toUserPublic(updated);
  }

  // Primeiro acesso: define a senha sem exigir a atual (válido só enquanto mustChangePassword).
  async completeFirstAccess(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return this.repo.update(userId, { passwordHash, mustChangePassword: false });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Senha atual incorreta');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.repo.update(userId, { passwordHash, mustChangePassword: false });
    return { success: true };
  }

  async remove(id: string, current: AuthUser) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (id === current.userId) {
      throw new BadRequestException('Você não pode excluir o próprio usuário');
    }
    const refs = await this.repo.countBlockingRefs(id);
    if (refs > 0) {
      throw new ConflictException(
        'Usuário tem chamados ou atividades vinculados e não pode ser excluído',
      );
    }
    await this.repo.remove(id);
    return { id };
  }
}
