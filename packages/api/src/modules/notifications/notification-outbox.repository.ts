import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Linhas ainda enviáveis: PENDING com menos de 3 tentativas, mais antigas primeiro.
  findPending(limit: number) {
    return this.prisma.notificationOutbox.findMany({
      where: { status: 'PENDING', attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  markSent(id: number) {
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  // Erro: incrementa tentativas e grava o motivo; ao chegar a 3, marca FAILED (para de tentar).
  markFailed(id: number, attempts: number, error: string) {
    const nextAttempts = attempts + 1;
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        lastError: error,
        status: nextAttempts >= 3 ? 'FAILED' : 'PENDING',
      },
    });
  }
}
