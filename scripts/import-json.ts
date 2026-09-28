#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { persistQuestions } from '../src/server/importer';
import { validateQuestions, } from '../src/server/importer/validate';
import type { ParsedQuestion } from '../src/server/importer/parse';

interface JsonQuestion {
  id?: number;
  question: string;
  options: string[];
  correct_answer: string;
  category?: string;
}

function fail(message: string): never {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

const fileArg = process.argv[2];
if (!fileArg || process.argv.includes('--help')) {
  console.log('Использование: npm run import:json -- <questions.json> [--dry-run] [--force]');
  process.exit(fileArg ? 0 : 1);
}

const file = resolve(process.cwd(), fileArg);
if (!existsSync(file)) fail(`Файл не найден: ${file}`);

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  fail(`Некорректный JSON: ${error instanceof Error ? error.message : 'ошибка разбора'}`);
}

if (!Array.isArray(raw)) fail('Корень JSON должен быть массивом вопросов');

const questions: ParsedQuestion[] = (raw as JsonQuestion[]).map((item, index) => {
  if (!item || typeof item !== 'object') fail(`Вопрос ${index + 1}: ожидался объект`);
  if (typeof item.question !== 'string' || item.question.trim().length === 0) {
    fail(`Вопрос ${index + 1}: поле question должно быть непустой строкой`);
  }
  if (!Array.isArray(item.options) || item.options.length < 2) {
    fail(`Вопрос ${index + 1}: поле options должно содержать минимум 2 варианта`);
  }
  if (typeof item.correct_answer !== 'string' || item.correct_answer.trim().length === 0) {
    fail(`Вопрос ${index + 1}: отсутствует correct_answer`);
  }

  const correct = item.correct_answer.trim();
  const options = item.options.map((option, optionIndex) => {
    if (typeof option !== 'string' || option.trim().length === 0) {
      fail(`Вопрос ${index + 1}, вариант ${optionIndex + 1}: ожидалась непустая строка`);
    }
    return { text: option.trim(), correct: option.trim() === correct };
  });

  return { text: item.question.trim(), options };
});

try {
  validateQuestions(questions);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Ошибка валидации вопросов');
}

console.log(`Проверено вопросов: ${questions.length}`);
console.log(`Вариантов: ${questions.reduce((sum, question) => sum + question.options.length, 0)}`);

if (process.argv.includes('--dry-run')) {
  console.log('dry-run: база не изменена');
  process.exit(0);
}

const prisma = new PrismaClient();
(async () => {
  try {
    const attempts = await prisma.attempt.count();
    if (attempts > 0 && !process.argv.includes('--force')) {
      fail(`В базе уже ${attempts} попыток. Для замены набора используйте --force.`);
    }
    const created = await persistQuestions(prisma, questions);
    console.log(`Импортировано вопросов в базу: ${created}`);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Не удалось записать вопросы в базу');
  } finally {
    await prisma.$disconnect();
  }
})();
