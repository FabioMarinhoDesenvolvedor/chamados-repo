import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly repo: DepartmentsRepository) {}

  list() {
    return this.repo.findAll();
  }

  async create(dto: CreateDepartmentDto) {
    const exists = await this.repo.findByName(dto.name);
    if (exists) throw new ConflictException('Departamento já existe');
    return this.repo.create({
      name: dto.name,
      priorityWeight: dto.priorityWeight,
      isRequesterDept: dto.isRequesterDept ?? true,
      isExecutorDept: dto.isExecutorDept ?? false,
      requiresApproval: dto.requiresApproval ?? false,
      notificationEmail: dto.notificationEmail ?? null,
    });
  }

  async remove(id: number) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Departamento não encontrado');
    const [users, tickets, categories] = await Promise.all([
      this.repo.countUsers(id),
      this.repo.countTickets(id),
      this.repo.countCategories(id),
    ]);
    if (users + tickets + categories > 0) {
      throw new ConflictException(
        'Departamento tem usuários, chamados ou categorias vinculadas e não pode ser excluído',
      );
    }
    await this.repo.remove(id);
    return { id };
  }
}
