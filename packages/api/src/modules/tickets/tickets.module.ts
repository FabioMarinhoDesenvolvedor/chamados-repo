import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { UsersModule } from '../users/users.module';
import { VaultModule } from '../vault/vault.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { PriorityService } from './priority.service';
import { SlaService } from './sla.service';

@Module({
  imports: [DepartmentsModule, UsersModule, VaultModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsRepository, PriorityService, SlaService],
})
export class TicketsModule {}
