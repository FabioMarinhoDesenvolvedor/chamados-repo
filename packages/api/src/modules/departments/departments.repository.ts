import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: number) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name } });
  }

  create(data: Prisma.DepartmentCreateInput) {
    return this.prisma.department.create({ data });
  }

  countUsers(departmentId: number) {
    return this.prisma.user.count({ where: { departmentId } });
  }

  // Conta tanto chamados abertos PELO setor (solicitante) quanto EXECUTADOS por ele.
  countTickets(departmentId: number) {
    return this.prisma.ticket.count({
      where: { OR: [{ departmentId }, { executorDepartmentId: departmentId }] },
    });
  }

  countCategories(departmentId: number) {
    return this.prisma.ticketCategory.count({ where: { departmentId } });
  }

  remove(id: number) {
    return this.prisma.department.delete({ where: { id } });
  }
}
