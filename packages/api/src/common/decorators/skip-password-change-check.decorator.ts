import { SetMetadata } from '@nestjs/common';

// Marca rotas acessíveis mesmo quando o usuário ainda precisa trocar a senha
// (ex.: ver o próprio perfil e efetuar a troca). Lido pelo MustChangePasswordGuard.
export const SKIP_PASSWORD_CHANGE_CHECK = 'skipPasswordChangeCheck';
export const SkipPasswordChangeCheck = () => SetMetadata(SKIP_PASSWORD_CHANGE_CHECK, true);
