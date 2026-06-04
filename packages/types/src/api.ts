/** Standard API response envelope */
export interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

/** Standard API error envelope */
export interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  };
}

/** Cursor-paginated list response */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    requestId: string;
    timestamp: string;
    nextCursor: string | null;
    hasMore: boolean;
  };
}
