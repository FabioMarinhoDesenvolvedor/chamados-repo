import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  update(id: number, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  // Upsert idempotente do user kiosk (dispositivo totem): reemitir o token do mesmo
  // label atualiza nome/setor, mas nunca regrava o hash de senha de um user existente.
  upsertKiosk(data: {
    email: string;
    name: string;
    departmentId: number;
    passwordHash: string;
  }) {
    return this.prisma.user.upsert({
      where: { email: data.email },
      create: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: 'USER',
        isKiosk: true,
        mustChangePassword: false,
        department: { connect: { id: data.departmentId } },
      },
      update: {
        name: data.name,
        department: { connect: { id: data.departmentId } },
      },
    });
  }

  // Vínculos que impedem exclusão (chamados/atividades). read_state é descartável.
  async countBlockingRefs(userId: number): Promise<number> {
    const [requested, assigned, comments, statusChanges] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where: { requesterId: userId } }),
      this.prisma.ticket.count({ where: { assignedTo: userId } }),
      this.prisma.ticketComment.count({ where: { authorId: userId } }),
      this.prisma.ticketStatusHistory.count({ where: { changedBy: userId } }),
    ]);
    return requested + assigned + comments + statusChanges;
  }

  remove(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.ticketReadState.deleteMany({ where: { userId } });
      return tx.user.delete({ where: { id: userId } });
    });
  }
}
