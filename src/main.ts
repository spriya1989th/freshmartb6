import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  const allowedOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map(o => o.trim()).filter(Boolean);
  app.enableCors({
    origin: ['http://localhost:3000', ...allowedOrigins, /\.vercel\.app$/, /\.railway\.app$/],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Health check for Railway
  const adapter = app.getHttpAdapter();
  adapter.get('/health', (_req: any, res: any) => res.status(200).json({ status: 'ok' }));

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`FreshMart API running on port ${port}`);
}
bootstrap();
