import { CatalogStatus, ConfigResource } from '../../../common/enums/db.enums.js';
import type { Condition } from '../../../engines/conditions/condition.types.js';
import type { CompiledQuestionSet } from '../../../engines/questionnaire/questionnaire.types.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConfigHandler } from '../../config-publishing/application/config-handler.decorator.js';
import type { CompileResult, ConfigIssue, ConfigResourceHandler } from '../../config-publishing/domain/config.types.js';
import { type QuestionSetContent, questionSetContentSchema } from '../domain/question-set.schema.js';
import { QuestionRepository } from '../infrastructure/question.repository.js';
import { compileQuestion } from './questionnaire.views.js';

const SCOPE_CHECKS = [
  ['segments', 'segments'],
  ['subSegments', 'subSegments'],
  ['categories', 'categories'],
] as const;

@ConfigHandler(ConfigResource.question_set)
export class QuestionSetHandler implements ConfigResourceHandler<QuestionSetContent, CompiledQuestionSet> {
  readonly resource = ConfigResource.question_set;
  readonly contentSchema = questionSetContentSchema;

  constructor(
    private readonly questions: QuestionRepository,
    private readonly dictionary: AttributeDictionary,
    private readonly catalog: CatalogQueryService,
  ) {}

  async compile(content: QuestionSetContent): Promise<CompileResult<CompiledQuestionSet>> {
    const parsed = questionSetContentSchema.safeParse(content);
    if (!parsed.success) {
      return { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    }
    const set = parsed.data;
    const issues: ConfigIssue[] = [];
    await this.checkScope(set, issues);

    const sectionKeys = new Set<string>();
    for (const [index, section] of set.sections.entries()) {
      if (sectionKeys.has(section.key)) issues.push({ path: `content.sections.${index}.key`, code: 'duplicate', message: `section ${section.key} is listed twice` });
      sectionKeys.add(section.key);
    }

    const rows = new Map((await this.questions.findByKeys(set.items.map((item) => item.questionKey))).map((row) => [row.key, row]));
    const attributes = await this.dictionary.active();
    const seen = new Set<string>();
    for (const [index, item] of set.items.entries()) {
      const path = `content.items.${index}`;
      const row = rows.get(item.questionKey);
      if (seen.has(item.questionKey)) issues.push({ path: `${path}.questionKey`, code: 'duplicate', message: `${item.questionKey} is listed twice` });
      seen.add(item.questionKey);
      if (!row) issues.push({ path: `${path}.questionKey`, code: 'unknown_question', message: `unknown question ${item.questionKey}` });
      else if (row.status !== CatalogStatus.active) issues.push({ path: `${path}.questionKey`, code: 'inactive_question', message: `${item.questionKey} is inactive` });
      else if (!attributes.has(row.attributeKey)) issues.push({ path: `${path}.questionKey`, code: 'inactive_attribute', message: `${item.questionKey} fills inactive attribute ${row.attributeKey}` });
      if (item.section && !sectionKeys.has(item.section)) issues.push({ path: `${path}.section`, code: 'unknown_section', message: `unknown section ${item.section}` });
      if (item.visibleIf !== undefined) {
        const check = await this.dictionary.validate(item.visibleIf);
        for (const issue of check.issues) issues.push({ path: `${path}.visibleIf${issue.path.slice(1)}`, code: 'invalid_condition', message: issue.message });
      }
    }
    if (issues.length > 0) return { compiled: null, issues };

    return {
      compiled: {
        stage: set.stage,
        scope: set.scope,
        sections: set.sections,
        items: set.items.flatMap((item) => {
          const row = rows.get(item.questionKey);
          return row ? [{ question: compileQuestion(row), required: item.required, section: item.section ?? null, visibleIf: (item.visibleIf as Condition | undefined) ?? null }] : [];
        }),
      },
      issues: [],
    };
  }

  private async checkScope(set: QuestionSetContent, issues: ConfigIssue[]) {
    const known = await this.catalog.referenceKeys();
    for (const [dimension, catalogKey] of SCOPE_CHECKS) {
      for (const [index, key] of (set.scope[dimension] ?? []).entries()) {
        if (!known[catalogKey].has(key)) issues.push({ path: `content.scope.${dimension}.${index}`, code: 'unknown_key', message: `unknown or inactive ${dimension} key ${key}` });
      }
    }
  }
}
