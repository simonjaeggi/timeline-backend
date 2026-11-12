import { NotImplementedError } from '../../../shared/errors.ts';
import type { EntryParser } from './parser.types.ts';

/**
 * Placeholder for LinkedIn's data export ("Get a copy of your data"), which
 * contains CSV files such as Positions.csv and Education.csv with
 * "Started On" / "Finished On" columns like "Jan 2020".
 * Implementation idea: parse the CSV, map each row to a ParsedEntry with
 * month precision, category work/education, and the row values as sourceRef.
 */
export const linkedInParser: EntryParser = {
  source: 'linkedin',
  parse() {
    throw new NotImplementedError(
      'Import from LinkedIn is not implemented yet.',
    );
  },
};

/** Placeholder for Xing profile exports, same idea as LinkedIn. */
export const xingParser: EntryParser = {
  source: 'xing',
  parse() {
    throw new NotImplementedError('Import from Xing is not implemented yet.');
  },
};
