import { getRepositories } from '../../data/index.ts';
import type { Person } from '../../data/models.ts';
import { toEntryView, type EntryView } from '../entries/entry.view.ts';
import type { SearchQueryDto } from './zod/search.schema.ts';

/**
 * Searches people (names) and entries (title, description) of a group.
 * Backs the search bar of the frontend.
 */
export async function search(
  groupId: number,
  query: SearchQueryDto,
): Promise<{ people: Person[]; entries: EntryView[] }> {
  const repositories = getRepositories();

  const [people, entries] = await Promise.all([
    repositories.people.list(groupId, { q: query.q, limit: query.limit }),
    repositories.entries.findPage(
      groupId,
      { q: query.q },
      { pageNumber: 1, pageSize: query.limit },
    ),
  ]);

  return { people, entries: entries.items.map(toEntryView) };
}
