import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';
import { RedisIoAdapter } from './infrastructure/redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  const configService = app.get(ConfigService);

  const redisIoAdapter = new RedisIoAdapter(app);
  const redisUrl = configService.get<string>('REDIS_URL');
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);

  app.use(helmet());

  const corsOrigins = configService.get<string[]>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Sales Copilot Platform API')
      .setDescription('Omnichannel Conversation Platform REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 8000);
  await app.listen(port);
  logger.log(`🚀 Sales Copilot API running on http://localhost:${port}/${globalPrefix}`);
  if (nodeEnv !== 'production') {
    logger.log(`📚 Swagger documentation available at http://localhost:${port}/docs`);
  }
}

void bootstrap();
