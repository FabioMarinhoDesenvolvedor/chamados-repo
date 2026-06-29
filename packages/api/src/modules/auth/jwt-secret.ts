import { ConfigService } from '@nestjs/config';

// Segredo placeholder de desenvolvimento que NUNCA pode rodar de verdade.
const PLACEHOLDER = 'dev-secret-change-me';

/**
 * Lê o JWT_SECRET com fail-fast: a aplicação NÃO sobe com segredo ausente,
 * trivial ou o placeholder de exemplo. Evita o risco de um deploy usar
 * silenciosamente um segredo conhecido (qualquer um forjaria tokens).
 */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.trim().length < 16 || secret === PLACEHOLDER) {
    throw new Error(
      'JWT_SECRET ausente, fraco ou igual ao placeholder. Defina um segredo forte (>= 16 caracteres) na env.',
    );
  }
  return secret;
}
