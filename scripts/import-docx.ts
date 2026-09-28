#!/usr/bin/env tsx
/*
 * Одноразовый импорт вопросов из DOCX в SQLite. Запускается до запуска приложения:
 *
 *   npm run import -- path/to/test.docx
 *   npm run import -- test.docx --dry-run
 *   npm run import -- test.docx --adapter checkbox
 *   npm run import -- test.docx --questions '^\d+\.\s+' --options '^[а-я]\)\s+'
 *
 * Опции: --dry-run, --force, --adapter <name>, --questions <regex>,
 *        --options <regex>, --json <out.json>, --keep-answers
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ADAPTERS, ImportFormatError, DocxParseError, importDocx, persistQuestions } from '../src/server/importer';

const HELP = `Импорт вопросов из DOCX в SQLite.

Использование: npm run import -- <file.docx> [опции]

Опции:
  --dry-run            Только разобрать документ, в базу ничего не писать
  --force              Заменить вопросы, даже если уже есть попытки
  --keep-answers       Не удалять попытки при замене (ответы потеряют связь с вопросами)
  --adapter <name>     default | ${Object.keys(ADAPTERS).join(' | ')}
  --questions <regex>  Свой regex начала вопроса (например '^\d+\.\s+')
  --options <regex>    Свой regex начала варианта
  --json <out.json>    Дополнительно сохранить нормализованный JSON
  --help               Показать справку`;

interface CliArgs {
  file?: string;
  dryRun: boolean;
  force: boolean;
  adapter?: string;
  questions?: string;
  options?: string;
  json?: string;
}

function fail(message: string): never {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

function compile(pattern: string, what: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch (error) {
    fail(`Некорректный regex ${what}: ${(error as Error).message}`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      const value = argv[++i] as string | undefined;
      if (value === undefined) fail(`Опция ${arg} требует аргумент`);
      return value;
    };
    switch (arg) {
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--adapter':
        args.adapter = next();
        break;
      case '--questions':
        args.questions = next();
        break;
      case '--options':
        args.options = next();
        break;
      case '--json':
        args.json = next();
        break;
      case '--help':
      case '-h':
        console.log(HELP);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) fail(`Неизвестная опция «${arg}». --help для списка.`);
        if (args.file) fail(`Укажите один файл DOCX (лишний аргумент «${arg}»)`);
        args.file = arg;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.log(HELP);
  process.exit(0);
}

const file = resolve(process.cwd(), args.file);
if (!existsSync(file)) fail(`Файл не найден: ${file}`);

let questions;
try {
  questions = importDocx(readFileSync(file), {
    adapter: args.adapter,
    questions: args.questions ? compile(args.questions, '--questions') : undefined,
    options: args.options ? compile(args.options, '--options') : undefined,
  });
} catch (error) {
  if (error instanceof ImportFormatError || error instanceof DocxParseError) {
    fail(error.message);
  }
  throw error;
}

const optionCount = questions.reduce((sum, question) => sum + question.options.length, 0);
console.log(`Разбрано вопросов: ${questions.length}, вариантов: ${optionCount}`);

for (const [index, question] of questions.entries()) {
  const correct = question.options.findIndex((option) => option.correct);
  console.log(`  ${index + 1}. ${question.text.slice(0, 72)}`);
  console.log(`     вариантов: ${question.options.length}, верный: №${correct + 1}`);
}

if (args.json) {
  const out = resolve(process.cwd(), args.json);
  writeFileSync(out, JSON.stringify(questions, null, 2), 'utf8');
  console.log(`JSON записан: ${out}`);
}

if (args.dryRun) {
  console.log('dry-run: база не изменена');
  process.exit(0);
}

const prisma = new PrismaClient();
(async () => {
  try {
    const attempts = await prisma.attempt.count();
    if (attempts > 0 && !args.force) {
      await prisma.$disconnect();
      fail(
        `В базе уже ${attempts} попыток; замена вопросов удалит их привязку к ответам. ` +
          'Повторите с --force для подтверждения (либо --keep-answers, чтобы не трогать попытки).',
      );
    }

    const created = await persistQuestions(prisma, questions);
    console.log(`Импортировано вопросов в базу: ${created}`);
  } catch (error) {
    fail(
      error instanceof Error
        ? `${error.message}\nБаза не изменена (операция в транзакции)`
        : 'Не удалось записать в базу',
    );
  } finally {
    await prisma.$disconnect();
  }
})();
