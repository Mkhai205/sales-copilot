export interface ErrorDetails {
  field?: string;
  message?: string;
  [key: string]: unknown;
}

export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;
  public readonly timestamp: string;
  public readonly details?: ErrorDetails | ErrorDetails[];

  constructor(message: string, details?: ErrorDetails | ErrorDetails[]) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class DomainError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'DOMAIN_ERROR';
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';

  constructor(resource: string, identifier?: string | number) {
    const msg = identifier
      ? `${resource} with id '${identifier}' not found`
      : `${resource} not found`;
    super(msg);
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'UNAUTHORIZED';

  constructor(message = 'Unauthorized access') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly code = 'FORBIDDEN';

  constructor(message = 'Access forbidden') {
    super(message);
  }
}

export class ValidationError extends AppError {
  public readonly statusCode = 422;
  public readonly code = 'VALIDATION_ERROR';

  constructor(message = 'Validation failed', details?: ErrorDetails | ErrorDetails[]) {
    super(message, details);
  }
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly code = 'CONFLICT';

  constructor(message = 'Resource conflict') {
    super(message);
  }
}
