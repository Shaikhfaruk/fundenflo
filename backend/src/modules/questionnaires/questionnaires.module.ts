import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { PartiesModule } from '../parties/parties.module.js';
import { AnswerMergeParticipant } from './application/answer-merge.participant.js';
import { AttributeNeedRegistry } from './application/attribute-need.registry.js';
import { QuestionSetHandler } from './application/question-set.handler.js';
import { QuestionService } from './application/question.service.js';
import { QuestionnaireService } from './application/questionnaire.service.js';
import { AdminQuestionSetPreviewController } from './http/admin-question-set-preview.controller.js';
import { AdminQuestionsController } from './http/admin-questions.controller.js';
import { CatalogQuestionsController } from './http/catalog-questions.controller.js';
import { OpsAnswersController } from './http/ops-answers.controller.js';
import { AnswerRepository } from './infrastructure/answer.repository.js';
import { QuestionRepository } from './infrastructure/question.repository.js';

const AdminQuestionSetsController = createVersionedConfigController({
  resource: ConfigResource.question_set,
  path: 'question-sets',
  name: 'AdminQuestionSetsController',
});

@Module({
  imports: [AttributesModule, CatalogModule, ConfigPublishingModule, DiscoveryModule, PartiesModule],
  controllers: [AdminQuestionsController, AdminQuestionSetsController, AdminQuestionSetPreviewController, CatalogQuestionsController, OpsAnswersController],
  providers: [AnswerMergeParticipant, AttributeNeedRegistry, QuestionRepository, AnswerRepository, QuestionService, QuestionSetHandler, QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnairesModule {}
