import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Categorias > subcategorias > detalhes aninhados, já ordenados — uma query, sem N+1.
  findAllWithSubcategories() {
    return this.prisma.ticketCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          orderBy: { sortOrder: 'asc' },
          include: { details: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  // Inclui os detalhes para validar obrigatoriedade/pertencimento na criação do chamado.
  findSubcategory(id: string) {
    return this.prisma.ticketSubcategory.findUnique({
      where: { id },
      include: { category: true, details: { orderBy: { sortOrder: 'asc' } } },
    });
  }
}
