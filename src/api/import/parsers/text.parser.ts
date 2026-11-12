import { createHash } from 'node:crypto';
import {
  ENTRY_CATEGORIES,
  ENTRY_KINDS,
  type EntryCategory,
  type EntryKind,
} from '../../../data/models.ts';
import { parsePartialDate } from '../../../shared/partial-date.ts';
import type { ParsedEntry } from '../zod/parsed-entry.schema.ts';
import type { EntryParser, ParseIssue, ParseResult } from './parser.types.ts';

const KINDS = new Set<string>(ENTRY_KINDS);
const CATEGORIES = new Set<string>(ENTRY_CATEGORIES);

/**
 * Builds a stable reference so re-importing the same line is a no-op.
 */
function sourceRefFor(entry: Omit<ParsedEntry, 'sourceRef'>): string {
  const key = [
    entry.start.date,
    entry.start.precision,
    entry.end?.date ?? '',
    entry.title.toLowerCase(),
  ].join('|');

  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/**
 * Plain text format, one entry per line:
 *
 *   <date or range> | <title> [| <description> [| <tags>]]
 *
 * - date: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; a range is `<start>..<end>`
 * - tags: comma or space separated kind/category names, e.g. `milestone, education`
 * - empty lines and lines starting with `#` are ignored
 *
 * Example:
 *   2020-09..2024-06 | BSc International IT Management | HSLU | milestone, education
 *   2025-07-14 | Climbing trip to Ticino | | activity, hobby
 */
export const textParser: EntryParser = {
  source: 'text',

  parse(content, options): ParseResult {
    const entries: ParsedEntry[] = [];
    const issues: ParseIssue[] = [];

    content.split(/\r?\n/).forEach((rawLine, index) => {
      const line = index + 1;
      const text = rawLine.trim();

      if (text === '' || text.startsWith('#')) return;

      const fields = text.split('|').map((field) => field.trim());
      const [dateField = '', title = '', description = '', tagField = ''] =
        fields;

      if (fields.length > 4) {
        issues.push({ line, message: 'Too many "|" separated fields.' });
        return;
      }

      if (title === '') {
        issues.push({ line, message: 'Expected "<date> | <title>".' });
        return;
      }

      const [startText = '', endText, ...rest] = dateField.split('..');
      const start = parsePartialDate(startText, 'start');
      const end =
        endText === undefined ? null : parsePartialDate(endText, 'end');

      if (!start || (endText !== undefined && !end) || rest.length > 0) {
        issues.push({
          line,
          message: `Invalid date "${dateField}". Use YYYY, YYYY-MM, YYYY-MM-DD or <start>..<end>.`,
        });
        return;
      }

      if (end && end.date < start.date) {
        issues.push({ line, message: 'End cannot be before start.' });
        return;
      }

      let kind: EntryKind = options.defaultKind;
      let category: EntryCategory = options.defaultCategory;

      for (const rawTag of tagField.split(/[\s,]+/).filter(Boolean)) {
        const tag = rawTag.replace(/^#/, '').toLowerCase();

        if (KINDS.has(tag)) {
          kind = tag as EntryKind;
        } else if (CATEGORIES.has(tag)) {
          category = tag as EntryCategory;
        } else {
          issues.push({ line, message: `Unknown tag "${rawTag}".` });
          return;
        }
      }

      const entry = {
        kind,
        category,
        title,
        description: description === '' ? null : description,
        start,
        end,
        location: null,
      };

      entries.push({ ...entry, sourceRef: sourceRefFor(entry) });
    });

    return { entries, issues };
  },
};
