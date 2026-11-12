import type { EntryParser, ImportSource } from './parser.types.ts';
import { linkedInParser, xingParser } from './profile-export.parsers.ts';
import { textParser } from './text.parser.ts';

const parsers: Record<ImportSource, EntryParser> = {
  text: textParser,
  linkedin: linkedInParser,
  xing: xingParser,
};

/**
 * Returns the parser for a source. Register new sources here and in IMPORT_SOURCES.
 */
export function getParser(source: ImportSource): EntryParser {
  return parsers[source];
}
