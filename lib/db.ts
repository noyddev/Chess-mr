import { PrismaClient } from "@prisma/client";

// Singleton pattern for serverless environments
// Prevents multiple PrismaClient instances in Vercel/Netlify functions
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  
  // Log connection attempt (without credentials)
  if (databaseUrl) {
    try {
      const urlObj = new URL(databaseUrl);
      console.log(`[DATABASE] Connecting to: ${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`);
    } catch {
      console.error("[DATABASE_ERROR] Invalid DATABASE_URL format");
    }
  } else {
    console.error("[DATABASE_ERROR] DATABASE_URL environment variable is not set");
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : process.env.NODE_ENV === "production"
        ? ["error"]
        : ["error", "warn"],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  // Log successful client creation
  console.log("[DATABASE] Prisma client created");
  
  return client;
}

// Reuse existing client in production to avoid connection explosion
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Log initial connection test
if (typeof window === "undefined") {
  prisma.$connect()
    .then(() => console.log("[DATABASE] Initial connection established"))
    .catch((err) => console.error("[DATABASE_ERROR] Initial connection failed:", err));
}

// Connection cleanup for serverless - call this at the end of each function
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
    console.log("[DATABASE] Disconnected");
  }
}

export default prisma;
