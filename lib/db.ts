import { PrismaClient } from "@prisma/client";

// Singleton pattern for serverless environments
// Prevents multiple PrismaClient instances in Vercel functions
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
  
  return client;
}

// Reuse existing client in production to avoid connection explosion
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Connection cleanup for serverless - call this at the end of each function
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}

export default prisma;
