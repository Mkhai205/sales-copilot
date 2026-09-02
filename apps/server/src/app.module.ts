import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue';
import { RedisModule } from './infrastructure/redis';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { WorkspacesModule } from './modules/workspaces';
import { TeamsModule } from './modules/teams';
import { ContactsModule } from './modules/contacts';
import { InboxesModule } from './modules/inboxes';
import { WebhooksModule } from './modules/webhooks';
import { LabelsModule } from './modules/labels';
import { CannedResponsesModule } from './modules/canned-responses';
import { AutomationRulesModule } from './modules/automation-rules';
import { AuditLogsModule } from './modules/audit-logs';
import { ConversationsModule } from './modules/conversations';
import { MessagesModule } from './modules/messages';
import { IntegrationsModule } from './integrations';
import { RealtimeModule } from './modules/realtime';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config';
import { RequestIdMiddleware } from './common/middlewares';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
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
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        };
      },
    }),
    EventEmitterModule.forRoot(),
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
    AuthModule,
    WorkspacesModule,
    TeamsModule,
    ContactsModule,
    InboxesModule,
    WebhooksModule,
    LabelsModule,
    CannedResponsesModule,
    AutomationRulesModule,
    AuditLogsModule,
    ConversationsModule,
    MessagesModule,
    IntegrationsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
