import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Bootstrap LIMPO para produção: cria apenas 1 admin (sem departamentos, usuários
// de exemplo ou chamados). O admin define a senha real via "Primeiro acesso" e
// cadastra departamentos/usuários pela interface.
// E-mail configurável por env ADMIN_EMAIL (default: admin@chamados.local).
const prisma = new PrismaClient();
const EMAIL = process.env.ADMIN_EMAIL || 'admin@chamados.local';

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Admin já existe: ${EMAIL} — nada a fazer.`);
    return;
  }
  // Senha placeholder + mustChangePassword: a senha real é definida no "Primeiro acesso".
  const passwordHash = await bcrypt.hash('definir-no-primeiro-acesso', 10);
  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: EMAIL,
      passwordHash,
      role: 'ADMIN',
      mustChangePassword: true,
    },
  });
  // eslint-disable-next-line no-console
  console.log(
    [
      `Admin criado: ${EMAIL}`,
      'Na tela de login, use "Primeiro acesso? Defina sua senha" para definir a senha.',
      'Sistema vazio: cadastre departamentos e usuários pela interface (perfil admin).',
    ].join('\n'),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
