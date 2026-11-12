import { getRepositories } from '../../data/index.ts';
import type { AuthUser } from '../../middleware/auth.middleware.ts';
import { ValidationError } from '../../shared/errors.ts';
import { toErrorIssues } from '../../shared/validation.ts';
import { assertPeopleInGroup, toEntryDates } from '../entries/entry.service.ts';
import { toEntryView, type EntryView } from '../entries/entry.view.ts';
import { getParser } from './parsers/parser.registry.ts';
import type { ParseIssue } from './parsers/parser.types.ts';
import {
  ParsedEntrySchema,
  type ParsedEntry,
} from './zod/parsed-entry.schema.ts';
import type { ImportRequestDto } from './zod/import.schema.ts';

export type ImportPreview = {
  entries: ParsedEntry[];
  issues: ParseIssue[];
};

export type ImportResult = {
  created: number;
  skippedDuplicates: number;
  issues: ParseIssue[];
  entries: EntryView[];
};

/**
 * Runs the parser and re-validates its output against the canonical format.
 * @param input import request
 * @returns Valid entries and all issues found.
 */
export function parseImport(input: ImportRequestDto): ImportPreview {
  const parser = getParser(input.source);
  const result = parser.parse(input.content, {
    defaultKind: input.defaults.kind,
    defaultCategory: input.defaults.category,
  });

  const entries: ParsedEntry[] = [];
  const issues = [...result.issues];

  for (const candidate of result.entries) {
    const validated = ParsedEntrySchema.safeParse(candidate);

    if (validated.success) {
      entries.push(validated.data);
    } else {
      const details = toErrorIssues(validated.error)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ');
      issues.push({
        line: null,
        message: `Parser produced an invalid entry ("${candidate.title}"): ${details}`,
      });
    }
  }

  return { entries, issues };
}

/**
 * Parses and stores entries. All-or-nothing unless `skipInvalid` is set.
 * Entries already imported earlier (same source and sourceRef) are skipped.
 * @throws {ValidationError} parse issues and skipInvalid is false, or unknown people
 */
export async function importEntries(
  groupId: number,
  user: AuthUser,
  input: ImportRequestDto,
): Promise<ImportResult> {
  const { entries, issues } = parseImport(input);

  if (issues.length > 0 && !input.skipInvalid) {
    throw new ValidationError(
      `Import has ${issues.length} issue(s). Fix them or set skipInvalid.`,
      issues.map((issue) => ({
        path: issue.line === null ? 'content' : `content.line.${issue.line}`,
        message: issue.message,
      })),
    );
  }

  await assertPeopleInGroup(groupId, input.personIds, 'personIds');

  const participants = [...new Set(input.personIds)].map((personId) => ({
    personId,
    role: null,
  }));

  const result = await getRepositories().entries.createMany(
    entries.map((entry) => ({
      entry: {
        groupId,
        kind: entry.kind,
        category: entry.category,
        title: entry.title,
        description: entry.description,
        ...toEntryDates(entry.start, entry.end),
        location: entry.location,
        source: input.source,
        sourceRef: entry.sourceRef,
        createdBy: user.id,
      },
      participants,
    })),
  );

  return {
    created: result.created.length,
    skippedDuplicates: result.skipped,
    issues,
    entries: result.created.map(toEntryView),
  };
}
