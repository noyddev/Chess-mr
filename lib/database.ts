/**
 * Database utility functions for resilient serverless operations
 */

import { prisma } from "./db";

// Maximum retries for transient failures
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 100;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a database operation with retry logic
 * Handles transient failures like connection timeouts
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on last attempt
      if (attempt === retries) break;
      
      // Check if error is retryable
      const isRetryable = 
        error instanceof Error && (
          error.message.includes("Connection") ||
          error.message.includes("timeout") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("P1001") || // Neon: computation pool not found
          error.message.includes("P1003") || // Neon: prepared statement not found
          error.message.includes("P2024") // Neon: connection pool timeout
        );
      
      if (!isRetryable) {
        throw error;
      }
      
      // Exponential backoff
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }
  
  throw lastError;
}

/**
 * Check if database is reachable
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await withRetry(() => prisma.$queryRaw`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe database query wrapper that never throws
 * Returns null on any database failure
 */
export async function safeQuery<T>(
  operation: () => Promise<T>
): Promise<T | null> {
  try {
    return await withRetry(operation);
  } catch (error) {
    console.error("Database query failed:", error);
    return null;
  }
}

/**
 * Health check for API routes
 */
export async function databaseHealthCheck() {
  const isConnected = await checkDatabaseConnection();
  
  return {
    status: isConnected ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: isConnected ? "connected" : "disconnected",
  };
}
