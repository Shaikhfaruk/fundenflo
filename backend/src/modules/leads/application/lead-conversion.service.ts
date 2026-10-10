import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { LeadEventType, OfflineConversionStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseFromNumber, paiseToNumber } from '../../../common/money/paise.js';
import { LeadEvent } from '../../../engines/state-machines/machines/lead.machine.js';
import type { OfflineConversion, Prisma } from '../../../generated/prisma/client.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { AssignmentCloseReason } from '../domain/lead-routing.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadAssignmentService } from './lead-assignment.service.js';
import { LeadTimeline } from './lead-timeline.service.js';
import { LeadService } from './lead.service.js';

export type ConversionReport = {
  lenderName: string;
  lenderOrganizationId?: string;
  categoryKey?: string;
  sanctionedAmountPaise: number;
  disbursedAmountPaise?: number;
  sanctionedOn: string;
  disbursedOn?: string;
  loanAccountRef?: string;
  note?: string;
};

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export const toConversionView = (conversion: OfflineConversion) => ({
  id: conversion.id,
  leadId: conversion.leadId,
  assignmentId: conversion.assignmentId,
  organizationId: conversion.organizationId,
  lenderName: conversion.lenderName,
  lenderOrganizationId: conversion.lenderOrganizationId,
  categoryKey: conversion.categoryKey,
  sanctionedAmountPaise: paiseToNumber(conversion.sanctionedAmountPaise),
  disbursedAmountPaise: conversion.disbursedAmountPaise === null ? null : paiseToNumber(conversion.disbursedAmountPaise),
  sanctionedOn: day(conversion.sanctionedOn),
  disbursedOn: day(conversion.disbursedOn),
  loanAccountRef: conversion.loanAccountRef,
  note: conversion.note,
  status: conversion.status,
  reportedByUserId: conversion.reportedByUserId,
  decidedByUserId: conversion.decidedByUserId,
  decidedAt: conversion.decidedAt?.toISOString() ?? null,
  decisionNote: conversion.decisionNote,
  version: conversion.version,
  createdAt: conversion.createdAt.toISOString(),
});

@Injectable()
export class LeadConversionService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly leadService: LeadService,
    private readonly assignments: LeadAssignmentService,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
  ) {}

  async report(assignment: { id: string; leadId: string; organizationId: string }, input: ConversionReport, reportedByUserId: string) {
    const conversion = await this.leads.createConversion({
      leadId: assignment.leadId,
      assignmentId: assignment.id,
      organizationId: assignment.organizationId,
      lenderName: input.lenderName,
      lenderOrganizationId: input.lenderOrganizationId ?? null,
      categoryKey: input.categoryKey ?? null,
      sanctionedAmountPaise: paiseFromNumber(input.sanctionedAmountPaise),
      disbursedAmountPaise: input.disbursedAmountPaise === undefined ? null : paiseFromNumber(input.disbursedAmountPaise),
      sanctionedOn: asDate(input.sanctionedOn),
      disbursedOn: input.disbursedOn ? asDate(input.disbursedOn) : null,
      loanAccountRef: input.loanAccountRef ?? null,
      note: input.note ?? null,
      reportedByUserId,
    });
    const details = { conversionId: conversion.id, leadId: assignment.leadId, organizationId: assignment.organizationId, lenderName: input.lenderName, disbursed: input.disbursedOn !== undefined };
    await this.timeline.record(assignment.leadId, LeadEventType.conversion_reported, { note: input.note ?? null, data: details });
    await this.changes.record({ action: AuditAction.OfflineConversionReported, entityType: AuditEntity.OfflineConversion, entityId: conversion.id, event: EventName.OfflineConversionReported, metadata: details, payload: details });
    return toConversionView(conversion);
  }

  async forAssignment(assignmentId: string) {
    return (await this.leads.conversionsForAssignment(assignmentId)).map(toConversionView);
  }

  async list(scope: Prisma.OfflineConversionWhereInput, status: OfflineConversionStatus, query: PageQuery) {
    const window = pageWindow(query);
    const rows = await this.leads.listConversions({ AND: [scope, { status, id: window.idFilter }] }, window.take);
    return toPage(rows, query.limit, (row) => ({ ...toConversionView(row), lead: row.lead, organization: row.organization }));
  }

  @Transactional()
  async decide(id: string, verify: boolean, note: string | undefined, actorUserId: string) {
    const conversion = await this.leads.findConversion({ id });
    if (!conversion) throw new AppError(ErrorCode.NOT_FOUND);
    await this.leads.lockLead(conversion.leadId);
    if (conversion.status !== OfflineConversionStatus.reported) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: conversion.status, event: verify ? 'verify' : 'reject', allowed: [] } });
    if (conversion.reportedByUserId === actorUserId) throw new AppError(ErrorCode.SELF_APPROVAL_NOT_ALLOWED);
    const status = verify ? OfflineConversionStatus.verified : OfflineConversionStatus.rejected;
    if (verify) {
      const assignment = await this.leads.findAssignment(conversion.assignmentId);
      if (assignment) await this.assignments.complete(assignment, AssignmentCloseReason.OfflineConversionVerified, note ?? null);
      await this.leadService.act(conversion.leadId, { event: LeadEvent.Convert, note });
      await this.leadService.act(conversion.leadId, { event: LeadEvent.Win, note });
    }
    const moved = await this.leads.updateConversionFromStatus(id, OfflineConversionStatus.reported, { status, decidedByUserId: actorUserId, decidedAt: new Date(), decisionNote: note ?? null });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    const details = { conversionId: id, leadId: conversion.leadId, organizationId: conversion.organizationId, status };
    await this.timeline.record(conversion.leadId, LeadEventType.conversion_decided, { reason: status, note: note ?? null, data: details });
    await this.changes.record({
      action: AuditAction.OfflineConversionDecided,
      entityType: AuditEntity.OfflineConversion,
      entityId: id,
      event: verify ? EventName.OfflineConversionVerified : EventName.OfflineConversionRejected,
      metadata: details,
      payload: { ...details, disbursedAmountPaise: conversion.disbursedAmountPaise === null ? null : paiseToNumber(conversion.disbursedAmountPaise) },
    });
    const updated = await this.leads.findConversion({ id });
    return updated ? toConversionView(updated) : null;
  }
}
