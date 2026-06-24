import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env";
import { checkDatabaseConnection } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const errors: string[] = [];
  const sourceStatus: Array<{ source: string; status: string; lastSync: string | null; error: string | null }> = [];

  // 1. Validate environment variables
  const envValidation = validateEnv();
  
  if (!envValidation.valid) {
    errors.push(`Environment validation failed: missing=${envValidation.missing.join(", ")}, invalid=${envValidation.invalid.join(", ")}`);
  }

  // 2. Check database connection
  let dbConnected = false;
  let dbError: string | null = null;
  
  try {
    dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      dbError = "Database connection check failed";
      errors.push(dbError);
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unknown database error";
    errors.push(`Database error: ${dbError}`);
  }

  // 3. Get record counts
  let playerCount = 0;
  let tournamentCount = 0;
  let pairingCount = 0;
  let standingCount = 0;
  let lichessProfileCount = 0;

  try {
    if (dbConnected) {
      [playerCount, tournamentCount] = await Promise.all([
        prisma.player.count(),
        prisma.tournament.count(),
      ]);

      // Count via TournamentPlayer for standings
      standingCount = await prisma.tournamentPlayer.count();
      
      // Count pairings
      pairingCount = await prisma.pairing.count();
      
      // Count lichess profiles (players with lichess username)
      lichessProfileCount = await prisma.player.count({
        where: { lichessUsername: { not: null } },
      });
    }
  } catch (err) {
    const countError = err instanceof Error ? err.message : "Unknown count error";
    errors.push(`Count error: ${countError}`);
  }

  // 4. Get sync status for each source
  const syncSources = ["chess-results", "lichess"];
  
  for (const source of syncSources) {
    try {
      const lastSync = await prisma.syncLog.findFirst({
        where: { source },
        orderBy: { startedAt: "desc" },
        select: {
          status: true,
          completedAt: true,
          error: true,
        },
      });

      sourceStatus.push({
        source,
        status: lastSync?.status || "never_run",
        lastSync: lastSync?.completedAt?.toISOString() || null,
        error: lastSync?.error || null,
      });
    } catch (err) {
      sourceStatus.push({
        source,
        status: "error",
        lastSync: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // 5. Build response
  const response = {
    database: dbConnected ? "up" : "down",
    lastSync: sourceStatus.find(s => s.source === "chess-results")?.lastSync || null,
    players: playerCount,
    tournaments: tournamentCount,
    pairings: pairingCount,
    standings: standingCount,
    lichessProfiles: lichessProfileCount,
    sourceStatus,
    errors,
    envValidation: {
      valid: envValidation.valid,
      missing: envValidation.missing,
      invalid: envValidation.invalid,
      warnings: envValidation.warnings,
      databaseUrlSet: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV || "not set",
    },
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
  };

  // Return 503 if there are critical errors
  const statusCode = errors.length > 0 && !dbConnected ? 503 : 200;

  console.log("[SYNC_STATUS]", JSON.stringify(response, null, 2));

  return NextResponse.json(response, { status: statusCode });
}
