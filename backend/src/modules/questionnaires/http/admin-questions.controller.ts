import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import type { QuestionOption } from '../../../engines/questionnaire/questionnaire.types.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { QuestionService } from '../application/question.service.js';
import { type CreateQuestionDto, createQuestionSchema, type ListQuestionsQuery, listQuestionsSchema, type UpdateQuestionDto, updateQuestionSchema } from './questionnaires.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'Question'));

@Controller('admin/questions')
@StaffOnly()
export class AdminQuestionsController {
  constructor(private readonly questions: QuestionService) {}

  @Get()
  @canRead
  async list(@ValidQuery(listQuestionsSchema) query: ListQuestionsQuery) {
    return { items: await this.questions.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Question'))
  create(@ValidBody(createQuestionSchema) body: CreateQuestionDto) {
    return this.questions.create({ ...body, options: body.options as QuestionOption[] | undefined });
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.questions.get(id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Question'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateQuestionSchema) body: UpdateQuestionDto, @IfMatchVersion() version: number | undefined) {
    return this.questions.update(id, { ...body, options: body.options as QuestionOption[] | undefined }, version);
  }
}
