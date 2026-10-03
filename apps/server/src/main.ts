import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createCorsOptions } from './config/cors.config';
import { HELMET_CONFIG } from './config/helmet.config';
import { RedisIoAdapter } from './infrastructure/redis/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  const configService = app.get(ConfigService);

  const redisIoAdapter = new RedisIoAdapter(app);
  const redisUrl = configService.get<string>('REDIS_URL');
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);

  app.use(helmet(HELMET_CONFIG));

  const corsOrigins = configService.get<string[]>('CORS_ORIGIN');
  app.enableCors(createCorsOptions(corsOrigins));

  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix, {
    exclude: ['widget/sdk.js', 'widget/sdk'],
  });

  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Body/query validation is enforced per-route with Zod pipes (@ZodBody /
  // @ZodQuery, schemas from @sales-copilot/shared-contracts); raw ZodErrors
  // are mapped to 400 VALIDATION_FAILED by HttpExceptionFilter.

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
