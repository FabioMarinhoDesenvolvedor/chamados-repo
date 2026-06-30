// Fonte única de verdade das regras de senha (DRY). Usado pelo back (DTOs) e
// pelo front (validação dos formulários). Nunca repetir literais de senha fora daqui.

// Senha escolhida pelo próprio usuário (primeiro acesso, trocar senha): forte.
export const PASSWORD_MIN_LENGTH = 8;
// Mín. 8 caracteres, com ao menos 1 letra e 1 número.
export const STRONG_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_RULE_MESSAGE =
  'A senha deve ter ao menos 8 caracteres, incluindo uma letra e um número.';

export function isStrongPassword(value: string): boolean {
  return STRONG_PASSWORD_REGEX.test(value);
}

// Senha temporária definida pelo admin ao criar/resetar um usuário. O usuário é
// obrigado a trocá-la no primeiro acesso (onde a regra forte é aplicada).
export const TEMP_PASSWORD_MIN_LENGTH = 6;
