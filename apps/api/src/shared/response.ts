import type { FastifyRequest } from 'fastify';

export function apiResponse<T>(request: FastifyRequest, data: T) {
  return {
    data,
    meta: {
      requestId: request.id,
      timestamp: new Date().toISOString(),
    },
  };
}

export function paginatedResponse<T>(
  request: FastifyRequest,
  data: T[],
  nextCursor: string | null,
) {
  return {
    data,
    meta: {
      requestId: request.id,
      timestamp: new Date().toISOString(),
      nextCursor,
      hasMore: nextCursor !== null,
    },
  };
}
