import { Injectable } from '@nestjs/common';
import { Complexity, Priority } from '@chamados/shared';
import { computePriority } from './priority.matrix';

@Injectable()
export class PriorityService {
  compute(complexity: Complexity, priorityWeight: number): Priority {
    return computePriority(complexity, priorityWeight);
  }
}
