import { LIMITS } from './config';
import type { ParticipantInput, SubmittedAnswer, SubmissionPayload } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Strips control characters, collapses whitespace and caps the length. */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new ValidationError('��������� ������');
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- intentional control-char stripping
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length > maxLength) {
    throw new ValidationError(`���� ������� ${maxLength} ��������`);
  }
  return cleaned;
}

export function parseParticipant(raw: unknown): ParticipantInput {
  if (!raw || typeof raw !== 'object') throw new ValidationError('�� �������� ������ ���������');
  const source = raw as Record<string, unknown>;

  const firstName = sanitizeText(source.firstName, LIMITS.name);
  const lastName = sanitizeText(source.lastName, LIMITS.name);
  const staticId = sanitizeText(source.staticId, LIMITS.staticId);

  if (firstName.length < 1) throw new ValidationError('������� ���');
  if (lastName.length < 1) throw new ValidationError('������� �������');
  if (staticId.length < 1) throw new ValidationError('������� Static ID');

  return { firstName, lastName, staticId };
}

export function parseAnswers(raw: unknown): SubmittedAnswer[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationError('�� �������� ������');
  }
  if (raw.length > LIMITS.answerCount) {
    throw new ValidationError('������� ����� �������');
  }

  const seen = new Set<number>();
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new ValidationError('������������ �����');
    const source = entry as Record<string, unknown>;
    const questionId = source.questionId;
    const optionId = source.optionId;

    if (!Number.isInteger(questionId)) throw new ValidationError('������������ ������������� �������');
    if (optionId !== null && optionId !== undefined && !Number.isInteger(optionId)) {
      throw new ValidationError('������������ ������������� ��������');
    }
    if (seen.has(questionId as number)) throw new ValidationError('������������� ����� �� ������');
    seen.add(questionId as number);

    return { questionId: questionId as number, optionId: (optionId as number | null) ?? null };
  });
}

export function parseSubmission(raw: unknown): Omit<SubmissionPayload, 'browserId'> {
  if (!raw || typeof raw !== 'object') throw new ValidationError('������������ ���� �������');
  const source = raw as Record<string, unknown>;
  return {
    participant: parseParticipant(source.participant),
    answers: parseAnswers(source.answers),
  };
}
