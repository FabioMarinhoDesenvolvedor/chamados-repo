import { Injectable } from '@nestjs/common';
import { Priority } from '@chamados/shared';
import { slaHours } from './sla.matrix';

@Injectable()
export class SlaService {
  hours(priority: Priority): number {
    return slaHours(priority);
  }

  // Prazo final = início (saída da triagem) + horas da prioridade.
  dueAt(priority: Priority, startedAt: Date): Date {
    return new Date(startedAt.getTime() + this.hours(priority) * 60 * 60 * 1000);
  }
}
