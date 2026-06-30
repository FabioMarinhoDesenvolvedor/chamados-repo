import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { PriorityService } from './priority.service';
import { SlaService } from './sla.service';

@Module({
  imports: [DepartmentsModule, CategoriesModule, UsersModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsRepository, PriorityService, SlaService],
})
export class TicketsModule {}
