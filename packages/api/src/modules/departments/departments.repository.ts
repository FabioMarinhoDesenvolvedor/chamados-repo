import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name } });
  }

  create(data: Prisma.DepartmentCreateInput) {
    return this.prisma.department.create({ data });
  }

  countUsers(departmentId: string) {
    return this.prisma.user.count({ where: { departmentId } });
  }

  countTickets(departmentId: string) {
    return this.prisma.ticket.count({ where: { departmentId } });
  }

  remove(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
