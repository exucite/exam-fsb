import { describe, it, expect, beforeAll } from 'vitest';
import { importDocx, ADAPTERS } from '@/server/importer';
import { zipSync } from 'fflate';

/** Utility to build a test DOCX from mock XML. */
function createTestDocx(documentXml: string): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': new TextEncoder().encode(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '</Types>',
    ),
    'word/document.xml': new TextEncoder().encode(documentXml),
  };
  return zipSync(files);
}

describe('importer', () => {
  describe('valid documents', () => {
    it('parses simple questions', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. What is 2+2?</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) 3</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) ✓ 4</w:t></w:r></w:p>
            <w:p><w:r><w:t>2. What is 5+5?</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) 9</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) ✓ 10</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      const questions = importDocx(createTestDocx(xml));
      expect(questions).toHaveLength(2);
      expect(questions[0]?.text).toContain('2+2');
      expect(questions[0]?.options).toHaveLength(2);
    });

    it('respects checkbox marks', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Pick one</w:t></w:r></w:p>
            <w:p checked="true"><w:r><w:t>☑ Option A</w:t></w:r></w:p>
            <w:p><w:r><w:t>☐ Option B</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      const questions = importDocx(createTestDocx(xml));
      expect(questions[0]?.options[0]?.correct).toBe(true);
      expect(questions[0]?.options[1]?.correct).toBe(false);
    });
  });

  describe('validation errors', () => {
    it('rejects no questions', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body/>
        </w:document>`;
      expect(() => importDocx(createTestDocx(xml))).toThrow('Не найдено ни одного вопроса');
    });

    it('rejects fewer than 2 options', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Question?</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) ✓ Only option</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      expect(() => importDocx(createTestDocx(xml))).toThrow('найдено 1 вариант');
    });

    it('rejects no correct answer', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Question?</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) Wrong</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) Also wrong</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      expect(() => importDocx(createTestDocx(xml))).toThrow('не отмечен верный вариант');
    });

    it('rejects multiple correct answers', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Question?</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) ✓ Right</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) ✓ Also right</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      expect(() => importDocx(createTestDocx(xml))).toThrow('отмечено 2 верных вариантов');
    });

    it('rejects duplicate questions', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Question A</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) ✓ Opt</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) Opt2</w:t></w:r></w:p>
            <w:p><w:r><w:t>2. Question A</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) ✓ Opt3</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) Opt4</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      expect(() => importDocx(createTestDocx(xml))).toThrow('дублирует вопрос');
    });

    it('rejects duplicate options', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Question?</w:t></w:r></w:p>
            <w:p><w:r><w:t>a) ✓ Same</w:t></w:r></w:p>
            <w:p><w:r><w:t>b) Same</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      expect(() => importDocx(createTestDocx(xml))).toThrow('дублирует вариант');
    });
  });

  describe('adapters', () => {
    it('checkbox-only adapter', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Is this correct?</w:t></w:r></w:p>
            <w:p checked="true"><w:r><w:t>Yes ✓</w:t></w:r></w:p>
            <w:p><w:r><w:t>☐ No</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      const questions = importDocx(createTestDocx(xml), { adapter: 'checkbox' });
      expect(questions).toHaveLength(1);
      expect(questions[0]?.options).toHaveLength(2);
      expect(questions[0]?.options[0]?.correct).toBe(true);
      expect(questions[0]?.options[1]?.correct).toBe(false);
    });

    it('plain adapter: numbered questions, unnumbered options, trailing marks', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>Часть I. Общие положения</w:t></w:r></w:p>
            <w:p><w:r><w:t>1. Первый вопрос?</w:t></w:r></w:p>
            <w:p><w:r><w:t>Вариант A</w:t></w:r></w:p>
            <w:p><w:r><w:t>Вариант B ✓</w:t></w:r></w:p>
            <w:p><w:r><w:t>2. Второй вопрос?</w:t></w:r></w:p>
            <w:p><w:r><w:t>Вариант C✓</w:t></w:r></w:p>
            <w:p><w:r><w:t>Вариант D</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      const questions = importDocx(createTestDocx(xml), { adapter: 'plain' });
      expect(questions).toHaveLength(2);
      expect(questions[0]?.text).toBe('Первый вопрос?');
      expect(questions[0]?.options.map((o) => o.correct)).toEqual([false, true]);
      expect(questions[1]?.options.map((o) => o.correct)).toEqual([true, false]);
    });

    it('plain adapter: decimal points in question text are not option numbers', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Что освобождает по статьям 12.8, 12.8.1, 13.1 и 13.2 УК?</w:t></w:r></w:p>
            <w:p><w:r><w:t>Задержание</w:t></w:r></w:p>
            <w:p><w:r><w:t>Добровольная сдача ✓</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      const questions = importDocx(createTestDocx(xml), { adapter: 'plain' });
      expect(questions).toHaveLength(1);
      expect(questions[0]?.text).toContain('12.8.1');
      expect(questions[0]?.options).toHaveLength(2);
      expect(questions[0]?.options[1]?.correct).toBe(true);
    });

    it('plain adapter: inline numbered options inside one paragraph', () => {
      const xml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>1. Кто НЕ является субъектом? </w:t></w:r><w:br/>
            <w:r><w:t>  1. Первый</w:t></w:r><w:br/>
            <w:r><w:t>  2. Второй</w:t></w:r><w:br/>
            <w:r><w:t>  3. Третий ✓</w:t></w:r><w:br/>
            <w:r><w:t>  Автор: Тест</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
      const questions = importDocx(createTestDocx(xml), { adapter: 'plain' });
      expect(questions).toHaveLength(1);
      expect(questions[0]?.options).toHaveLength(3);
      expect(questions[0]?.options[2]?.correct).toBe(true);
      expect(questions[0]?.options[0]?.text).toBe('Первый');
    });
  });
});
