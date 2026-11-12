import { z } from '@hono/zod-openapi';
import { DATE_PRECISIONS, type DatePrecision } from '../data/models.ts';

/**
 * A date that may only be known to the year or month ("2019", "2019-06", "2019-06-14").
 * Stored as a full ISO date plus its precision:
 * - start dates use the first day of the period (2019-06 -> 2019-06-01)
 * - end dates use the last day of the period (2019-06 -> 2019-06-30)
 * This keeps range queries simple while the precision tells the UI how to display it.
 */
export type PartialDate = {
  date: string;
  precision: DatePrecision;
};

export type PartialDateEdge = 'start' | 'end';

/** API representation, `value` round-trips into the input format. */
export type PartialDateView = PartialDate & { value: string };

const PARTIAL_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Today's date (UTC) as `YYYY-MM-DD`. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Moves an ISO date by whole years, clamping Feb 29 to Feb 28 in non-leap years.
 * @param isoDate `YYYY-MM-DD`
 * @param years years to add (may be negative)
 */
export function addYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const targetYear = year + years;
  return toIsoDate(
    targetYear,
    month,
    Math.min(day, daysInMonth(targetYear, month)),
  );
}

/**
 * Parses a partial date string.
 * @param value `YYYY`, `YYYY-MM` or `YYYY-MM-DD`
 * @param edge whether the value starts or ends a period
 * @returns Normalised partial date, or null if the value is not a real date.
 */
export function parsePartialDate(
  value: string,
  edge: PartialDateEdge,
): PartialDate | null {
  const match = PARTIAL_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] === undefined ? undefined : Number(match[2]);
  const day = match[3] === undefined ? undefined : Number(match[3]);

  if (year < 1) return null;

  if (month === undefined) {
    return {
      date: edge === 'start' ? toIsoDate(year, 1, 1) : toIsoDate(year, 12, 31),
      precision: 'year',
    };
  }

  if (month < 1 || month > 12) return null;

  if (day === undefined) {
    return {
      date:
        edge === 'start'
          ? toIsoDate(year, month, 1)
          : toIsoDate(year, month, daysInMonth(year, month)),
      precision: 'month',
    };
  }

  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { date: toIsoDate(year, month, day), precision: 'day' };
}

/**
 * Returns the last day of the period a start date describes.
 * @param date normalised start date
 * @param precision precision of the start date
 */
export function endOfPeriod(date: string, precision: DatePrecision): string {
  const [year, month] = date.split('-').map(Number) as [number, number];

  switch (precision) {
    case 'day':
      return date;
    case 'month':
      return toIsoDate(year, month, daysInMonth(year, month));
    case 'year':
      return toIsoDate(year, 12, 31);
  }
}

/**
 * Formats a stored date for the API.
 * @param date stored ISO date
 * @param precision stored precision
 */
export function toPartialDateView(
  date: string,
  precision: DatePrecision,
): PartialDateView {
  const value =
    precision === 'year'
      ? date.slice(0, 4)
      : precision === 'month'
        ? date.slice(0, 7)
        : date;

  return { value, date, precision };
}

/**
 * Zod schema accepting `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
 * @param edge whether the value starts or ends a period
 */
export function partialDateSchema(edge: PartialDateEdge) {
  return z
    .string()
    .transform((value, ctx): PartialDate => {
      const parsed = parsePartialDate(value, edge);

      if (!parsed) {
        ctx.addIssue({
          code: 'custom',
          message: 'Date must be a valid YYYY, YYYY-MM or YYYY-MM-DD value.',
        });
        return z.NEVER;
      }

      return parsed;
    })
    .openapi({
      type: 'string',
      description: 'YYYY, YYYY-MM or YYYY-MM-DD',
      example: edge === 'start' ? '2024-09' : '2026',
    });
}

/** Already normalised partial date, used for parser output. */
export const DatePrecisionSchema = z
  .enum(DATE_PRECISIONS)
  .openapi('DatePrecision');

export const PartialDateObjectSchema = z
  .strictObject({
    date: z.iso.date(),
    precision: DatePrecisionSchema,
  })
  .openapi('PartialDate');

export const PartialDateViewSchema = z
  .object({
    value: z.string().openapi({
      description: 'Round-trips into the input format.',
      example: '2024-09',
    }),
    date: z.string().openapi({
      format: 'date',
      description: 'First day of the period for starts, last day for ends.',
      example: '2024-09-01',
    }),
    precision: DatePrecisionSchema,
  })
  .openapi('PartialDateView');
