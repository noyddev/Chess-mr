/**
 * Structured API Response System
 * Ensures all responses have consistent status reporting
 */

export type SystemStatus = "ok" | "degraded" | "error";

export interface ApiResponse<T> {
  data: T | null;
  status: SystemStatus;
  error: string | null;
  lastUpdated: string | null;
}

export interface HealthResponse {
  database: "up" | "down";
  sync: "healthy" | "stale" | "failed";
  lastSync: string | null;
  systemStatus: SystemStatus;
  timestamp: string;
  checks: {
    prisma: boolean;
    neon: boolean;
  };
}

/**
 * Create a structured API response
 */
export function createResponse<T>(
  data: T | null,
  options: {
    status?: SystemStatus;
    error?: string | null;
    lastUpdated?: Date | null;
  } = {}
): ApiResponse<T> {
  const { status = "ok", error = null, lastUpdated = null } = options;
  
  return {
    data,
    status,
    error,
    lastUpdated: lastUpdated instanceof Date 
      ? lastUpdated.toISOString() 
      : lastUpdated,
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, lastUpdated?: Date | null): ApiResponse<T> {
  return createResponse(data, {
    status: "ok",
    error: null,
    lastUpdated: lastUpdated ?? null,
  });
}

/**
 * Create an error response
 */
export function errorResponse<T>(error: string, data: T | null = null): ApiResponse<T> {
  return createResponse(data, {
    status: "error",
    error,
    lastUpdated: null,
  });
}

/**
 * Create a degraded response (partial failure)
 */
export function degradedResponse<T>(data: T, warning: string, lastUpdated?: Date | null): ApiResponse<T> {
  return createResponse(data, {
    status: "degraded",
    error: warning,
    lastUpdated: lastUpdated ?? null,
  });
}

/**
 * Determine status from error
 */
export function getStatusFromError(error: unknown): SystemStatus {
  if (!error) return "ok";
  return "error";
}
