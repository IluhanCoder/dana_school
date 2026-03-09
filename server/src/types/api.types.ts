/**
 * Standard API Response Format
 * 
 * All controllers should return responses in this format:
 * - success: true with "data" field on success
 * - success: false with "error" field on failure
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Helper type for pagination responses
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
