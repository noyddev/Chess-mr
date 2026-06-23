/**
 * Database utility functions for resilient serverless operations
 */

import { prisma } from "./db";
import type { HealthResponse } from "./api/response";

// Maximum retries for transient failures
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 100;

// Stale threshold: 30 minutes without sync
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

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
          error.message.includes("P1001") ||
          error.message.includes("P1003") ||
          error.message.includes("P2024")
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
 * Get last successful sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const lastSync = await prisma.syncLog.findFirst({
      where: { status: "success" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    return lastSync?.completedAt ?? null;
  } catch {
    return null;
  }
}

/**
 * Comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthResponse> {
  const timestamp = new Date();
  
  // Check database connection
  const [dbConnected, lastSync] = await Promise.all([
    checkDatabaseConnection().catch(() => false),
    getLastSyncTime().catch(() => null),
  ]);
  
  // Determine sync status
  let syncStatus: "healthy" | "stale" | "failed" = "failed";
  if (dbConnected) {
    if (lastSync) {
      const timeSinceSync = timestamp.getTime() - lastSync.getTime();
      if (timeSinceSync < STALE_THRESHOLD_MS) {
        syncStatus = "healthy";
      } else {
        syncStatus = "stale";
      }
    } else {
      syncStatus = "stale"; // No sync records
    }
  } else {
    syncStatus = "failed";
  }
  
  // Determine overall system status
  let systemStatus: "ok" | "degraded" | "error" = "ok";
  if (!dbConnected) {
    systemStatus = "error";
  } else if (syncStatus === "stale" || syncStatus === "failed") {
    systemStatus = "degraded";
  }
  
  return {
    database: dbConnected ? "up" : "down",
    sync: syncStatus,
    lastSync: lastSync?.toISOString() ?? null,
    systemStatus,
    timestamp: timestamp.toISOString(),
    checks: {
      prisma: dbConnected,
      neon: dbConnected,
    },
  };
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
 * Verify data was actually written after sync
 */
export async function verifySyncIntegrity(
  expectedTournaments: number,
  expectedPlayers: number
): Promise<{ valid: boolean; actualTournaments: number; actualPlayers: number }> {
  try {
    const [actualTournaments, actualPlayers] = await Promise.all([
      prisma.tournament.count(),
      prisma.player.count(),
    ]);
    
    return {
      valid: actualTournaments >= expectedTournaments && actualPlayers >= expectedPlayers,
      actualTournaments,
      actualPlayers,
    };
  } catch {
    return {
      valid: false,
      actualTournaments: 0,
      actualPlayers: 0,
    };
  }
}

/**
 * Health check for API routes (legacy)
 */
export async function databaseHealthCheck() {
  const isConnected = await checkDatabaseConnection();
  
  return {
    status: isConnected ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: isConnected ? "connected" : "disconnected",
  };
}
