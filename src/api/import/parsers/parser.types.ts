import type { EntryCategory, EntryKind } from '../../../data/models.ts';
import type { ParsedEntry } from '../zod/parsed-entry.schema.ts';

export const IMPORT_SOURCES = ['text', 'linkedin', 'xing'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export type ParseIssue = {
  /** 1-based line number in the input, null if not line based. */
  line: number | null;
  message: string;
};

export type ParserOptions = {
  defaultKind: EntryKind;
  defaultCategory: EntryCategory;
};

export type ParseResult = {
  entries: ParsedEntry[];
  issues: ParseIssue[];
};

/**
 * Turns raw content from one source into normalised entries.
 * Parsers are pure: no database access, no network.
 */
export interface EntryParser {
  readonly source: ImportSource;
  parse(content: string, options: ParserOptions): ParseResult;
}
