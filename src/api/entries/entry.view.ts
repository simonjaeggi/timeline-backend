import type {
  EntryCategory,
  EntryKind,
  EntrySource,
  EntryWithParticipants,
} from '../../data/models.ts';
import {
  toPartialDateView,
  type PartialDateView,
} from '../../shared/partial-date.ts';

/** Entry as returned by the API. `spanEnd` is internal and not exposed. */
export type EntryView = {
  id: number;
  groupId: number;
  kind: EntryKind;
  category: EntryCategory;
  title: string;
  description: string | null;
  start: PartialDateView;
  end: PartialDateView | null;
  location: string | null;
  source: EntrySource;
  sourceRef: string | null;
  participants: { personId: number; role: string | null }[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Maps a stored entry to its API representation.
 * @param entry stored entry with participants
 */
export function toEntryView(entry: EntryWithParticipants): EntryView {
  return {
    id: entry.id,
    groupId: entry.groupId,
    kind: entry.kind,
    category: entry.category,
    title: entry.title,
    description: entry.description,
    start: toPartialDateView(entry.startDate, entry.startPrecision),
    end:
      entry.endDate && entry.endPrecision
        ? toPartialDateView(entry.endDate, entry.endPrecision)
        : null,
    location: entry.location,
    source: entry.source,
    sourceRef: entry.sourceRef,
    participants: entry.participants.map(({ personId, role }) => ({
      personId,
      role,
    })),
    createdBy: entry.createdBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
