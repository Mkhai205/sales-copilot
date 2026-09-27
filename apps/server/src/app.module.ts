import { randomUUID } from 'node:crypto';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { ResendModule } from './infrastructure/email/resend.module';
import { IdentityModule } from './modules/identity/identity.module';
import { JwtAuthGuard } from './modules/identity/auth/guards/jwt-auth.guard';
import { OmnichannelModule } from './modules/omnichannel/omnichannel.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthModule } from './modules/health/health.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateEnv } from './config/env.validation';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { pinoRedactConfig } from './common/logging/redaction.config';

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
    ResendModule,
    IdentityModule,
    OmnichannelModule,
    CommerceModule,
    IntelligenceModule,
    PlatformAdminModule,
    RealtimeModule,
    HealthModule,
    DashboardModule,
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
