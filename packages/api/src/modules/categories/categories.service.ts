import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  // Lista os blocos (categorias) com suas subcategorias para o fluxo guiado de abertura.
  list() {
    return this.repo.findAllWithSubcategories();
  }
}
