import { readDocxParagraphs } from './docx';
import { ADAPTERS, compileAdapter, parseQuestions, type AdapterConfig, type ParsedQuestion } from './parse';
import { validateQuestions } from './validate';

export { DocxParseError } from './docx';
export { ImportFormatError } from './parse';
export type { ParsedQuestion, ParsedOption, AdapterConfig } from './parse';
export { ADAPTERS } from './parse';

export interface ImportOptions {
  /** Preset name from `ADAPTERS`. */
  adapter?: string;
  /** Overrides the preset's question-start pattern. */
  questions?: RegExp;
  /** Overrides the preset's option-start pattern. */
  options?: RegExp;
  /** Overrides the preset's inline "correct" marks. */
  marks?: readonly RegExp[];
}

export function resolveAdapter(options: ImportOptions = {}): AdapterConfig {
  const base = options.adapter ? ADAPTERS[options.adapter] : ADAPTERS.default;
  if (options.adapter && !base) {
    throw new Error(
      `Неизвестный адаптер «${options.adapter}». Доступны: ${Object.keys(ADAPTERS).join(', ')}`,
    );
  }
  return compileAdapter(base, {
    questions: options.questions,
    options: options.options,
    marks: options.marks,
  });
}

/** DOCX bytes -> validated question set. Throws on any format problem. */
export function importDocx(buffer: Uint8Array, options: ImportOptions = {}): ParsedQuestion[] {
  const adapter = resolveAdapter(options);
  const paragraphs = readDocxParagraphs(buffer);
  const questions = parseQuestions(paragraphs, adapter);
  validateQuestions(questions);
  return questions;
}

export interface PersistTarget {
  question: {
    deleteMany(): Promise<{ count: number }>;
    create(args: unknown): Promise<unknown>;
  };
}

/** Replaces (default) the stored question set inside a single transaction. */
export async function persistQuestions(
  client: {
    $transaction<T>(fn: (tx: PersistTarget) => Promise<T>): Promise<T>;
  },
  questions: readonly ParsedQuestion[],
): Promise<number> {
  return client.$transaction(async (tx) => {
    await tx.question.deleteMany();
    for (const [index, question] of questions.entries()) {
      await tx.question.create({
        data: {
          sortOrder: index + 1,
          text: question.text,
          options: {
            create: question.options.map((option, optionIndex) => ({
              sortOrder: optionIndex + 1,
              text: option.text,
              correct: option.correct,
            })),
          },
        },
      });
    }
    return questions.length;
  });
}
