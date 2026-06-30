import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  // TicketsModule usa o repositório para validar subcategoria e derivar o título.
  exports: [CategoriesRepository],
})
export class CategoriesModule {}
