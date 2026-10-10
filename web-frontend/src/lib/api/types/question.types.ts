type LocalisedText = Record<string, string>;

type QuestionOption = { value: string; label: LocalisedText; fact: unknown };

type QuestionValidation = { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string; maxSelections?: number };

type Question = {
  key: string;
  kind: string;
  label: LocalisedText;
  help: LocalisedText | null;
  options: QuestionOption[] | null;
  validation: QuestionValidation | null;
  ui: { widget?: string; columns?: number } | null;
  attributeKey: string;
};

export type ResolvedQuestion = { section: string | null; question: Question; required: boolean; setKey: string; setVersionId: string; visibility: string };

type QuestionSection = { key: string; label: LocalisedText };

type SavedAnswer = { questionKey: string; value: unknown; answeredAt: string };

export type ApplicationQuestions = { sets: Array<{ key: string; versionId: string; number: number }>; sections: QuestionSection[]; questions: ResolvedQuestion[]; hidden: string[]; answers: SavedAnswer[] };

export type AnswerInput = { questionKey: string; value: unknown };

export type AnswersResult = { remaining: string[]; hidden: string[] };
