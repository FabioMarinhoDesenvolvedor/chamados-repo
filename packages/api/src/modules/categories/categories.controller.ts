import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MustChangePasswordGuard } from '../../common/guards/must-change-password.guard';
import { CategoriesService } from './categories.service';

// Dado de referência: qualquer usuário autenticado lê (precisa para abrir chamado).
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }
}
