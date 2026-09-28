import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';

/** One logical line of the DOCX body, flattened out of tables and text boxes. */
export interface DocParagraph {
  text: string;
  /** True when Word marks this paragraph with a checked checkbox control. */
  checked: boolean;
}

export class DocxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxParseError';
  }
}

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

const decoder = new TextDecoder('utf-8');

function localName(key: string): string {
  const colon = key.indexOf(':');
  return colon === -1 ? key : key.slice(colon + 1);
}

function attributeIsTruthy(attributes: Record<string, unknown>): boolean {
  const entries = Object.entries(attributes);
  if (entries.length === 0) return true;
  return entries.some(([key, value]) => {
    const name = localName(key).toLowerCase();
    if (name !== 'val' && name !== 'checked') return false;
    const text = String(value).trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'on';
  });
}

function collectRuns(nodes: unknown[], out: string[], state: { checked: boolean }): void {
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const node = raw as XmlNode;
    const attributes = (node[':@'] as Record<string, unknown> | undefined) ?? {};

    for (const [key, value] of Object.entries(node)) {
      if (key === ':@') continue;
      if (key === '#text') {
        out.push(String(value));
        continue;
      }

      const name = localName(key);
      if (name === 'tab') {
        out.push('\t');
        continue;
      }
      if (name === 'br' || name === 'cr') {
        out.push('\n');
        continue;
      }
      // `w:default` inside a legacy `w:checkBox` is the unchecked default.
      if (name === 'default' || name === 'checkedState' || name === 'uncheckedState') continue;

      if (name === 'checked' || name === 'checkBox') {
        if (attributeIsTruthy(attributes)) state.checked = true;
        if (name === 'checked') continue;
      }

      if (Array.isArray(value)) collectRuns(value, out, state);
    }
  }
}

function visitForParagraphs(nodes: unknown[], out: DocParagraph[]): void {
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const node = raw as XmlNode;

    for (const [key, value] of Object.entries(node)) {
      if (key === ':@' || key === '#text') continue;
      if (!Array.isArray(value)) continue;

      if (localName(key) === 'p') {
        const state = { checked: false };
        const parts: string[] = [];
        collectRuns(value, parts, state);
        out.push({ text: parts.join(''), checked: state.checked });
        continue;
      }
      visitForParagraphs(value, out);
    }
  }
}

export function extractDocumentXml(buffer: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new DocxParseError('���� �� �������� ���������� DOCX: �� ������� ����������� �����');
  }
  const entry = files['word/document.xml'];
  if (!entry) throw new DocxParseError('� DOCX �� ������ word/document.xml');
  return decoder.decode(entry);
}

export function parseDocumentXml(xml: string): DocParagraph[] {
  let tree: unknown;
  try {
    tree = parser.parse(xml);
  } catch {
    throw new DocxParseError('�� ������� ��������� �������� word/document.xml');
  }
  if (!Array.isArray(tree)) throw new DocxParseError('����������� ��������� word/document.xml');

  const paragraphs: DocParagraph[] = [];
  visitForParagraphs(tree, paragraphs);
  return paragraphs;
}

/** Parses a `.docx` archive into ordered paragraphs. */
export function readDocxParagraphs(buffer: Uint8Array): DocParagraph[] {
  return parseDocumentXml(extractDocumentXml(buffer));
}
