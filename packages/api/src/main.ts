import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Headers de segurança (nosniff, X-Frame-Options, etc.). Como a API serve o
  // site por HTTP na rede local, desligamos o que força HTTPS: a CSP padrão
  // (upgrade-insecure-requests) e o HSTS — senão o navegador tenta puxar os
  // assets em https e quebra (ERR_SSL_PROTOCOL_ERROR).
  app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')?.split(',') ?? true,
    credentials: true,
  });

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API rodando em http://localhost:${port}/api`);
}

void bootstrap();
