import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  // Vínculos que impedem exclusão (chamados/atividades). read_state é descartável.
  async countBlockingRefs(userId: string): Promise<number> {
    const [requested, assigned, comments, statusChanges] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where: { requesterId: userId } }),
      this.prisma.ticket.count({ where: { assignedTo: userId } }),
      this.prisma.ticketComment.count({ where: { authorId: userId } }),
      this.prisma.ticketStatusHistory.count({ where: { changedBy: userId } }),
    ]);
    return requested + assigned + comments + statusChanges;
  }

  remove(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.ticketReadState.deleteMany({ where: { userId } });
      return tx.user.delete({ where: { id: userId } });
    });
  }
}
