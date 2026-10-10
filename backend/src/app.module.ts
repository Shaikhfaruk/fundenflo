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
import { ConsentsModule } from './modules/consents/consents.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { SubmissionsModule } from './modules/submissions/submissions.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { LendersModule } from './modules/lenders/lenders.module.js';
import { BorrowersModule } from './modules/borrowers/borrowers.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { ActivitiesModule } from './modules/activities/activities.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { SlaModule } from './modules/sla/sla.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PartnersModule } from './modules/partners/partners.module.js';
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
    ConsentsModule,
    PartnersModule,
    DocumentsModule,
    BorrowersModule,
    ApplicationsModule,
    LendersModule,
    AssessmentsModule,
    SubscriptionsModule,
    MatchingModule,
    SubmissionsModule,
    ActivitiesModule,
    SlaModule,
    RealtimeModule.forRoot({ worker: false }),
    SyncModule,
    LeadsModule,
    ImportsModule,
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
