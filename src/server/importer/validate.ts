import { ImportFormatError, type ParsedQuestion } from './parse';

const MIN_OPTIONS = 2;

/** Structural validation with human-readable, question-scoped errors. */
export function validateQuestions(questions: readonly ParsedQuestion[]): void {
  if (questions.length === 0) {
    throw new ImportFormatError('Не найдено ни одного вопроса');
  }

  const seenQuestions = new Map<string, number>();

  questions.forEach((question, index) => {
    const position = index + 1;
    const label = `Вопрос ${position}`;
    const key = question.text.toLocaleLowerCase('ru-RU');

    if (question.text.length === 0) {
      throw new ImportFormatError(`${label}: вопрос не может быть пустым`);
    }
    const duplicate = seenQuestions.get(key);
    if (duplicate !== undefined) {
      throw new ImportFormatError(`${label}: дублирует вопрос ${duplicate} («${question.text}»)`);
    }
    seenQuestions.set(key, position);

    if (question.options.length < MIN_OPTIONS) {
      throw new ImportFormatError(
        `${label}: найдено ${question.options.length} вариант(а), нужно минимум ${MIN_OPTIONS}`,
      );
    }

    const correctCount = question.options.filter((option) => option.correct).length;
    if (correctCount === 0) {
      throw new ImportFormatError(`${label}: не отмечен верный вариант`);
    }
    if (correctCount > 1) {
      throw new ImportFormatError(
        `${label}: отмечено ${correctCount} верных вариантов, должен быть только один`,
      );
    }

    const seenOptions = new Map<string, number>();
    question.options.forEach((option, optionIndex) => {
      const optionLabel = `${label}, вариант ${optionIndex + 1}`;
      if (option.text.length === 0) {
        throw new ImportFormatError(`${optionLabel}: вариант не может быть пустым`);
      }
      const optionKey = option.text.toLocaleLowerCase('ru-RU');
      const optionDuplicate = seenOptions.get(optionKey);
      if (optionDuplicate !== undefined) {
        throw new ImportFormatError(
          `${optionLabel}: дублирует вариант ${optionDuplicate} («${option.text}»)` ,
        );
      }
      seenOptions.set(optionKey, optionIndex + 1);
    });
  });
}
