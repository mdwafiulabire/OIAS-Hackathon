import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@oias/types';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  if (error instanceof AppError) {
    return reply.status(error.status).send({
      error: {
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        status: 400,
        details: { issues: error.issues },
      },
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        status: 400,
      },
    });
  }

  // Generic error
  const status = error.statusCode ?? 500;
  return reply.status(status).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: status === 500 ? 'Internal server error' : error.message,
      status,
    },
  });
}
