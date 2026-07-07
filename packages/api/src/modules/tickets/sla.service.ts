import { Injectable } from '@nestjs/common';
import { Complexity } from '@chamados/shared';
import { responseHours, resolutionHours } from './sla.matrix';

const MS_PER_HOUR = 60 * 60 * 1000;

@Injectable()
export class SlaService {
  // Complexidade nula (chamado legado sem categorização) cai no default MÉDIA — mesma
  // tolerância da priorização; nunca quebra o cálculo do prazo.
  private resolve(complexity: Complexity | null): Complexity {
    return complexity ?? 'MEDIUM';
  }

  responseHours(complexity: Complexity | null, priorityWeight: number): number {
    return responseHours(this.resolve(complexity), priorityWeight);
  }

  resolutionHours(complexity: Complexity | null, priorityWeight: number): number {
    return resolutionHours(this.resolve(complexity), priorityWeight);
  }

  responseDueAt(complexity: Complexity | null, priorityWeight: number, startedAt: Date): Date {
    return new Date(startedAt.getTime() + this.responseHours(complexity, priorityWeight) * MS_PER_HOUR);
  }

  resolutionDueAt(complexity: Complexity | null, priorityWeight: number, startedAt: Date): Date {
    return new Date(startedAt.getTime() + this.resolutionHours(complexity, priorityWeight) * MS_PER_HOUR);
  }
}
