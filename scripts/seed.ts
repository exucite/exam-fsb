#!/usr/bin/env tsx
/*
 * Демо-набор вопросов для локальной проверки (без DOCX):
 *   npm run seed
 */
import { PrismaClient } from '@prisma/client';

const demoQuestions = [
  {
    text: 'Какой протокол обеспечивает шифрование веб-трафика?',
    options: [
      { text: 'HTTPS', correct: true },
      { text: 'HTTP', correct: false },
      { text: 'FTP', correct: false },
    ],
  },
  {
    text: 'Что означает аббревиатура ORM?',
    options: [
      { text: 'Object-Relational Mapping', correct: true },
      { text: 'Open Resource Manager', correct: false },
    ],
  },
  {
    text: 'Сколько байт в одном килобайте по стандарту SI?',
    options: [
      { text: '1000', correct: true },
      { text: '1024', correct: false },
      { text: '512', correct: false },
    ],
  },
];

const prisma = new PrismaClient();

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany();
      for (const [index, question] of demoQuestions.entries()) {
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
    });
    console.log(`Загружено вопросов: ${demoQuestions.length}`);
  } catch (error) {
    console.error('Не удалось загрузить демо-вопросы:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
