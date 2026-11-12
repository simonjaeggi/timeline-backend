import { z } from '@hono/zod-openapi';
import { DateStringSchema } from '../../../shared/openapi.ts';
import {
  EntryFilterQuerySchema,
  EntrySchema,
} from '../../entries/zod/entry.schema.ts';

/**
 * `from` and `to` are inclusive. They default to one year around today.
 */
export const TimelineQuerySchema = EntryFilterQuerySchema.extend({
  includeBirthdays: z
    .stringbool({ error: 'includeBirthdays must be true or false.' })
    .default(true)
    .openapi({ type: 'boolean', default: true }),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: '"from" must not be after "to".',
  path: ['from'],
});

export type TimelineQueryDto = z.infer<typeof TimelineQuerySchema>;

export const TimelineEntryItemSchema = z
  .object({
    type: z.literal('entry'),
    key: z.string().openapi({ example: 'entry:7' }),
    date: DateStringSchema,
    entry: EntrySchema,
  })
  .openapi('TimelineEntryItem');

export const TimelineBirthdayItemSchema = z
  .object({
    type: z.literal('birthday'),
    key: z.string().openapi({ example: 'birthday:3:2024' }),
    date: DateStringSchema,
    personId: z.number().int(),
    age: z.number().int().openapi({ description: '0 is the day of birth.' }),
  })
  .openapi('TimelineBirthdayItem');

export const TimelineItemSchema = z
  .discriminatedUnion('type', [
    TimelineEntryItemSchema,
    TimelineBirthdayItemSchema,
  ])
  .openapi('TimelineItem');

export const TimelineSchema = z
  .object({
    from: DateStringSchema,
    to: DateStringSchema,
    truncated: z.boolean().openapi({
      description: 'More entries matched than returned; narrow the window.',
    }),
    items: z.array(TimelineItemSchema),
  })
  .openapi('Timeline');
