import { defineMachine } from '../define-machine.js';

export const ImportBatchState = {
  AwaitingUpload: 'awaiting_upload',
  Uploaded: 'uploaded',
  Mapped: 'mapped',
  Validating: 'validating',
  Validated: 'validated',
  Committing: 'committing',
  Committed: 'committed',
  Undoing: 'undoing',
  Undone: 'undone',
  Failed: 'failed',
} as const;

export type ImportBatchState = (typeof ImportBatchState)[keyof typeof ImportBatchState];

export const ImportBatchEvent = {
  Inspect: 'inspect',
  Map: 'map',
  Validate: 'validate',
  FinishValidation: 'finish_validation',
  Commit: 'commit',
  FinishCommit: 'finish_commit',
  Undo: 'undo',
  FinishUndo: 'finish_undo',
  Fail: 'fail',
} as const;

export type ImportBatchEvent = (typeof ImportBatchEvent)[keyof typeof ImportBatchEvent];

const S = ImportBatchState;

export const importBatchMachine = defineMachine<ImportBatchState, ImportBatchEvent>({
  name: 'import_batch',
  states: Object.values(ImportBatchState),
  transitions: {
    inspect: { from: [S.AwaitingUpload, S.Uploaded], to: S.Uploaded },
    map: { from: [S.Uploaded, S.Mapped, S.Validated, S.Failed], to: S.Mapped },
    validate: { from: [S.Mapped, S.Validated], to: S.Validating },
    finish_validation: { from: [S.Validating], to: S.Validated },
    commit: { from: [S.Validated, S.Committing], to: S.Committing },
    finish_commit: { from: [S.Committing], to: S.Committed },
    undo: { from: [S.Committed, S.Undoing], to: S.Undoing },
    finish_undo: { from: [S.Undoing], to: S.Undone },
    fail: { from: [S.Validating], to: S.Failed },
  },
});
