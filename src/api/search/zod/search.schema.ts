import { z } from '@hono/zod-openapi';
import { SearchTermSchema } from '../../../shared/zod/common.schema.ts';

export const SearchQuerySchema = z.object({
  q: SearchTermSchema,
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type SearchQueryDto = z.infer<typeof SearchQuerySchema>;
