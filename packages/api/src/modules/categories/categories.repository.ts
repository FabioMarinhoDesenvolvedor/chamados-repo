import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Categorias com subcategorias aninhadas, já ordenadas — uma query, sem N+1.
  findAllWithSubcategories() {
    return this.prisma.ticketCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { subcategories: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  findSubcategory(id: string) {
    return this.prisma.ticketSubcategory.findUnique({
      where: { id },
      include: { category: true },
    });
  }
}
