import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  DuplicateRecordError,
  IntegrityError,
  MissingReferenceError,
} from '../data/errors.ts';
import { AppError } from '../shared/errors.ts';

/**
 * Renders every error as `{ message, status, issues? }`.
 * Unknown errors are logged and hidden behind a generic 500.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        message: err.message,
        status: err.status,
        ...(err.issues ? { issues: err.issues } : {}),
      },
      err.status,
    );
  }

  if (err instanceof HTTPException) {
    return c.json({ message: err.message, status: err.status }, err.status);
  }

  // Safety net for constraint violations a service did not map itself.
  if (err instanceof DuplicateRecordError) {
    return c.json({ message: 'Record already exists.', status: 409 }, 409);
  }

  if (err instanceof MissingReferenceError || err instanceof IntegrityError) {
    return c.json({ message: err.message, status: 400 }, 400);
  }

  console.error(`[${c.get('requestId') ?? '-'}]`, err);
  return c.json({ message: 'Internal Server Error', status: 500 }, 500);
};

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json({ message: 'Route not found.', status: 404 }, 404);
