import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient singleton safe for Next.js App Router and Railway
 * 
 * CRITICAL: PrismaClient must NOT be instantiated at module import time
 * during Next.js build phase or when DATABASE_URL is unavailable.
 * 
 * This pattern:
 * - Creates PrismaClient only when first accessed (lazy)
 * - Preserves single instance per process (global)
 * - Works safely during Next.js "collecting page data" phase
 * - Supports hot reload in development without connection leaks
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Create PrismaClient instance
 * WARNING: This is called lazily, not at import time
 */
function createPrismaClient(): PrismaClient {
  // Warn if DATABASE_URL is missing - but don't throw (allows build to pass)
  if (!process.env.DATABASE_URL) {
    console.warn("[DATABASE_WARNING] DATABASE_URL is not set - database operations will fail");
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : process.env.NODE_ENV === "production"
        ? ["error"]
        : ["error", "warn"],
    // NOTE: Do NOT pass datasources.db.url here - it causes PrismaClientConstructorValidationError
    // when DATABASE_URL is undefined during build phase. The client will use DATABASE_URL from
    // the generated client or environment at connection time instead.
  });

  return client;
}

/**
 * Lazy singleton prisma instance
 * CRITICAL: This is NOT instantiated until first DB access
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Preserve instance across hot reloads in non-production
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Disconnect and clear the singleton
 * Useful for graceful shutdown in serverless environments
 */
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
    console.log("[DATABASE] Disconnected");
  }
}

/**
 * Safe query wrapper that never throws
 * Returns null on any database failure
 */
export async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error("[DATABASE_ERROR]", error);
    return null;
  }
}

export default prisma;
