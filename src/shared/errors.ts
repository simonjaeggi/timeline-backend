import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorIssue = {
  path: string;
  message: string;
};

/**
 * Base class for errors that map directly to an HTTP response.
 * Services and controllers throw these, the global error handler renders them.
 */
export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly issues: ErrorIssue[] | undefined;

  constructor(
    status: ContentfulStatusCode,
    message: string,
    issues?: ErrorIssue[],
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.issues = issues;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, issues?: ErrorIssue[]) {
    super(400, message, issues);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied.') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string) {
    super(501, message);
  }
}
