import { randomUUID } from 'node:crypto';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from './common/guards';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue';
import { RedisModule } from './infrastructure/redis';
import { StorageModule } from './infrastructure/storage/storage.module';
import { IdentityModule, JwtAuthGuard } from './modules/identity';
import { OmnichannelModule } from './modules/omnichannel';
import { CommerceModule } from './modules/commerce';
import { AutomationModule } from './modules/automation';
import { IntelligenceModule } from './modules/intelligence';
import { PlatformAdminModule } from './modules/platform-admin';
import { RealtimeModule } from './modules/realtime';
import { HealthModule } from './modules/health';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateEnv } from './config';
import { RequestIdMiddleware } from './common/middlewares';
import { pinoRedactConfig } from './common/logging';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', 'apps/server/.env', 'apps/server/.env.local'],
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const isDev = nodeEnv !== 'production';
        const logLevel = configService.get<string>('LOG_LEVEL') || (isDev ? 'debug' : 'info');

        return {
          pinoHttp: {
            level: logLevel,
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            autoLogging: true,
            redact: pinoRedactConfig,
            genReqId: (req: any, res: any) => {
              const existingId =
                (req.headers['x-request-id'] as string) ||
                (req.headers['x-correlation-id'] as string);
              const id = existingId || randomUUID();
              req.headers['x-request-id'] = id;
              res.setHeader('x-request-id', id);
              return id;
            },
            customAttributeKeys: {
              reqId: 'requestId',
            },
            customProps: (req: any) => {
              const requestId =
                (req.headers?.['x-request-id'] as string) ||
                (req.headers?.['x-correlation-id'] as string) ||
                req.id;
              const workspaceId =
                req.workspace?.workspaceId ||
                (typeof req.headers?.['x-workspace-id'] === 'string'
                  ? req.headers['x-workspace-id']
                  : undefined);
              const userId = req.user?.userId;

              return {
                requestId,
                ...(workspaceId ? { workspaceId } : {}),
                ...(userId ? { userId } : {}),
              };
            },
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
                headers: req.headers,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        };
      },
    }),
    EventEmitterModule.forRoot({
      maxListeners: 100,
      verboseMemoryLeak: false,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    QueueModule,
    RedisModule,
    StorageModule,
    IdentityModule,
    OmnichannelModule,
    CommerceModule,
    AutomationModule,
    IntelligenceModule,
    PlatformAdminModule,
    RealtimeModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
