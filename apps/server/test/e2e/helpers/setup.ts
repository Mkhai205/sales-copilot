import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/filters';
import { TransformInterceptor } from '../../../src/common/interceptors';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisIoAdapter, RedisService } from '../../../src/infrastructure/redis';

export interface TestAppContext {
  app: INestApplication;
  httpServer: any;
  prisma: PrismaService;
  redis: RedisService;
  configService: ConfigService;
  port: number;
  baseUrl: string;
  wsUrl: string;
  close: () => Promise<void>;
}

/**
 * Boots a full NestJS application configured identically to main.ts,
 * overriding the database to sales_copilot_test and binding to an ephemeral port.
 */
export async function createTestApp(): Promise<TestAppContext> {
  // Ensure test database is targeted
  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL?.replace('/sales_copilot_dev', '/sales_copilot_test') ||
    'postgresql://postgres:password@101.96.66.225:8005/sales_copilot_test?schema=public';

  process.env.DATABASE_URL = testDbUrl;
  process.env.NODE_ENV = 'test';
  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = 'warn';
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication({
    bufferLogs: true,
  });

  // Trust proxy for proxy headers in test runs
  const httpAdapter = app.getHttpAdapter();
  if (httpAdapter && typeof (httpAdapter.getInstance() as any)?.set === 'function') {
    (httpAdapter.getInstance() as any).set('trust proxy', 1);
  }

  const configService = app.get(ConfigService);
  const redisService = app.get(RedisService);
  const prismaService = app.get(PrismaService);

  // Setup WebSocket Redis adapter (for real-time events assertion)
  const redisIoAdapter = new RedisIoAdapter(app);
  const redisUrl = configService.get<string>('REDIS_URL');
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);

  // Set global API prefix matching production
  app.setGlobalPrefix('api/v1');

  // Cookie parser for JWT cookie extraction
  app.use(cookieParser());

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global validation pipe
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

  app.enableShutdownHooks();

  // Initialize and listen on random available port (0)
  await app.init();
  await app.listen(0);

  const httpServer = app.getHttpServer();
  const address = httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const wsUrl = `http://127.0.0.1:${port}/realtime`;

  const close = async () => {
    try {
      await redisIoAdapter.close();
    } catch {
      // Ignore if adapter is already closed
    }
    await app.close();
  };

  return {
    app,
    httpServer,
    prisma: prismaService,
    redis: redisService,
    configService,
    port,
    baseUrl,
    wsUrl,
    close,
  };
}
