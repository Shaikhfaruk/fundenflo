import { Controller, Get } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { LeadReportService } from '../application/lead-report.service.js';
import { type FunnelReportDto, funnelReportSchema, type ReportRangeDto, reportRangeSchema } from './leads.dto.js';

@Controller('ops/reports')
@StaffOnly()
export class OpsReportsController {
  constructor(private readonly reports: LeadReportService) {}

  @Get('leads/funnel')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Lead'))
  funnel(@ValidQuery(funnelReportSchema) query: FunnelReportDto) {
    return this.reports.funnel(query.groupBy, query.from, query.to);
  }

  @Get('partners/performance')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LeadAssignment'))
  performance(@ValidQuery(reportRangeSchema) query: ReportRangeDto) {
    return this.reports.partnerPerformance(query.from, query.to);
  }
}
