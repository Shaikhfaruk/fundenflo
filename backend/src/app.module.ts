import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ALL_ROUTES } from './common/constants/http.constants.js';
import { HttpErrorFilter } from './common/errors/http-error.filter.js';
import { EtagInterceptor } from './common/http/etag.interceptor.js';
import { JsonBodyMiddleware } from './common/http/json-body.middleware.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { AuthorizationModule } from './modules/access/authorization.module.js';
import { AttributesModule } from './modules/attributes/attributes.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ConfigPublishingModule } from './modules/config-publishing/config-publishing.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { QuestionnairesModule } from './modules/questionnaires/questionnaires.module.js';

@Module({
  imports: [
    InfrastructureModule.forRoot({ processName: 'api' }),
    AuditModule.forRoot({ http: true }),
    AuthorizationModule,
    NotificationsModule.forRoot({ worker: false }),
    HealthModule,
    AuthModule,
    CatalogModule,
    AttributesModule,
    ConfigPublishingModule,
    QuestionnairesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: EtagInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JsonBodyMiddleware).forRoutes(ALL_ROUTES);
  }
}
