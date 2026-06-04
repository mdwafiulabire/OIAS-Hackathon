export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      `${entity.toUpperCase()}_NOT_FOUND`,
      id ? `${entity} with id '${id}' not found` : `${entity} not found`,
      404,
    );
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition from '${from}' to '${to}'`,
      422,
    );
    this.name = 'InvalidTransitionError';
  }
}

export class PluginDisabledError extends AppError {
  constructor(pluginKey: string) {
    super(
      'PLUGIN_DISABLED',
      `Plugin '${pluginKey}' is not enabled for this organisation`,
      403,
    );
    this.name = 'PluginDisabledError';
  }
}
