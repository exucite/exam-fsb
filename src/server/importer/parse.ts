import type { DocParagraph } from './docx';

export interface ParsedOption { text: string; correct: boolean }
export interface ParsedQuestion { text: string; options: ParsedOption[] }

export interface AdapterConfig {
  readonly name: string;
  readonly description: string;
  readonly questionStart: RegExp;
  readonly optionStart: RegExp | null;
  readonly optionPrefixStrip: RegExp;
  readonly correctMarks: readonly RegExp[];
  readonly wrongMarks: readonly RegExp[];
  readonly questionNeedsQuestionMark?: boolean;
}

export class ImportFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'ImportFormatError'; }
}

const DEFAULT_QUESTION_START = /^(?:Вопрос\s*)?\d+\s*[.):-]\s+/i;
const LETTER_PREFIX = /^[A-Za-zА-Яа-яЁё]\s*[.)\]:]\s+/;
const CHECKBOX_PREFIX = /^[☐☑☒✓✔✗✘]\s*/;
const BRACKET_PREFIX = /^(?:\[[ xX✓✔]?\]|\([ xX✓✔]?\))\s*/;
const BULLET_PREFIX = /^[•·▪‣*]\s+/;
const OPTION_PREFIX_STRIP = /^(?:[A-Za-zА-Яа-яЁё]\s*[.)\]:]|[☐☑☒✓✔✗✘]|(?:\[[ xX✓✔]?\]|\([ xX✓✔]?\))|[•·▪‣*])\s*/;
const CORRECT_MARKS = [/\[[\s]*[xX✓✔][\s]*\]/i, /\([\s]*[xX✓✔][\s]*\)/i, /[☑✓✔]/];
const WRONG_MARKS = [/[✗✘☒]/, /\[[\s]*[-–—][\s]*\]/];

export const DEFAULT_ADAPTER: AdapterConfig = {
  name: 'default',
  description: 'Нумерованные вопросы и варианты с буквенными, маркерными или checkbox-префиксами.',
  questionStart: DEFAULT_QUESTION_START,
  optionStart: new RegExp(`(?:${LETTER_PREFIX.source}|${CHECKBOX_PREFIX.source}|${BRACKET_PREFIX.source}|${BULLET_PREFIX.source})`, 'i'),
  optionPrefixStrip: OPTION_PREFIX_STRIP,
  correctMarks: CORRECT_MARKS,
  wrongMarks: WRONG_MARKS,
};

export const CHECKBOX_ONLY_ADAPTER: AdapterConfig = {
  ...DEFAULT_ADAPTER,
  name: 'checkbox',
  description: 'Вопросы с вариантами, отмеченными checkbox-контролами.',
  optionStart: null,
};

export const PLAIN_TEXT_ADAPTER: AdapterConfig = {
  name: 'plain',
  description: 'Нумерованные вопросы и неформатированные варианты.',
  questionStart: /^\d+\.\s+/,
  optionStart: null,
  optionPrefixStrip: /^\d+\.\s+/,
  correctMarks: CORRECT_MARKS,
  wrongMarks: WRONG_MARKS,
  questionNeedsQuestionMark: true,
};

export const ADAPTERS: Record<string, AdapterConfig> = { default: DEFAULT_ADAPTER, checkbox: CHECKBOX_ONLY_ADAPTER, plain: PLAIN_TEXT_ADAPTER };

export function compileAdapter(adapter?: AdapterConfig, overrides: { questions?: RegExp; options?: RegExp; marks?: readonly RegExp[] } = {}): AdapterConfig {
  const base = adapter ?? DEFAULT_ADAPTER;
  return { ...base, questionStart: overrides.questions ?? base.questionStart, optionStart: overrides.options !== undefined ? overrides.options : base.optionStart, correctMarks: overrides.marks ?? base.correctMarks };
}

function normalize(text: string): string { return text.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim(); }
function stripOptionsPrefix(text: string, adapter: AdapterConfig): string { return normalize(text.replace(adapter.optionPrefixStrip, ' ')); }

function applyMarks(text: string, checked: boolean, adapter: AdapterConfig): ParsedOption {
  let clean = text;
  let correct = checked;
  for (const wrong of adapter.wrongMarks) if (wrong.test(clean)) clean = clean.replace(wrong, ' ');
  for (const mark of adapter.correctMarks) if (mark.test(clean)) { correct = true; clean = clean.replace(mark, ' '); }
  return { text: stripOptionsPrefix(clean, adapter), correct };
}
function hasCheckboxMark(text: string): boolean { return /[☐☑☒✓✔✗✘]/.test(text) || /\[[ xX✓✔]?\]/.test(text) || /\([ xX✓✔]?\)/.test(text); }

export function parseQuestions(paragraphs: readonly DocParagraph[], adapter: AdapterConfig = DEFAULT_ADAPTER): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;
  const lines: DocParagraph[] = [];
  for (const paragraph of paragraphs) for (const rawLine of paragraph.text.split('\n')) {
    const text = normalize(rawLine);
    if (text) lines.push({ text, checked: paragraph.checked });
  }

  for (const paragraph of lines) {
    const text = paragraph.text;
    if (/^(?:Автор|Составитель|Источник|Примечание)\s*:/i.test(text)) continue;
    const isPlain = adapter.name === 'plain';
    const isCheckboxOnly = adapter.name === 'checkbox' && adapter.optionStart === null;
    const isOption = isCheckboxOnly ? hasCheckboxMark(text) : adapter.optionStart !== null && adapter.optionStart.test(text);
    const isNewQuestion = adapter.questionStart.test(text) && (!adapter.questionNeedsQuestionMark || /\?\s*$/.test(text) || current === null);

    if (isNewQuestion) {
      if (current && current.options.length) questions.push(current);
      const questionText = normalize(text.replace(adapter.questionStart, ' '));
      if (!questionText) throw new ImportFormatError(`Пустой вопрос: «${text}»`);
      current = { text: questionText, options: [] };
      continue;
    }
    if (isOption) {
      if (!current) throw new ImportFormatError(`Вариант найден до первого вопроса: «${text}»`);
      current.options.push(applyMarks(text, paragraph.checked, adapter));
      continue;
    }
    if (!current) continue;
    if (isPlain) current.options.push(applyMarks(text, paragraph.checked, adapter));
    else if (!current.options.length) current.text = normalize(`${current.text} ${text}`);
    else current.options[current.options.length - 1]!.text = normalize(`${current.options[current.options.length - 1]!.text} ${text}`);
  }
  if (current) questions.push(current);
  return questions;
}
