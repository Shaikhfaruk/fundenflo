import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { AnalysisSubscriptionTarget } from './application/analysis-subscription.target.js';
import { AnalysisService } from './application/analysis.service.js';
import { ImprovementRuleHandler } from './application/improvement-rule.handler.js';
import { ScoringModelHandler } from './application/scoring-model.handler.js';
import { ScoringNeedSource } from './application/scoring-need.source.js';
import { ScoringService } from './application/scoring.service.js';
import { AnalysesController } from './http/analyses.controller.js';
import { ApplicationAssessmentsController } from './http/application-assessments.controller.js';
import { OpsAssessmentsController } from './http/ops-assessments.controller.js';
import { AnalysisRunProcessor } from './infrastructure/analysis-run.processor.js';
import { AssessmentRepository } from './infrastructure/assessment.repository.js';

const AdminScoringModelsController = createVersionedConfigController({ resource: ConfigResource.scoring_model, path: 'scoring-models', name: 'AdminScoringModelsController' });

const AdminImprovementRulesController = createVersionedConfigController({ resource: ConfigResource.improvement_rule, path: 'improvement-rules', name: 'AdminImprovementRulesController' });

export const ASSESSMENT_PROCESSORS = [AnalysisRunProcessor];

@Module({
  imports: [ApplicationsModule, AttributesModule, CatalogModule, ConfigPublishingModule, ConsentsModule, DocumentsModule],
  controllers: [ApplicationAssessmentsController, AnalysesController, OpsAssessmentsController, AdminScoringModelsController, AdminImprovementRulesController],
  providers: [AssessmentRepository, ScoringModelHandler, ImprovementRuleHandler, ScoringService, AnalysisService, ScoringNeedSource, AnalysisSubscriptionTarget],
  exports: [AnalysisService, ScoringService],
})
export class AssessmentsModule {}
