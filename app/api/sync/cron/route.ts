import { NextResponse } from "next/server";
import { runFullSync, syncTournamentDetails } from "@/services/sync/orchestrator";
import prisma from "@/lib/db";

// CRON_SECRET must be set in Railway environment variables
// This is a security requirement to prevent unauthorized cron triggers
const CRON_SECRET = process.env.CRON_SECRET;

function unauthorizedResponse(message: string) {
  return NextResponse.json(
    { error: "Unauthorized", message },
    { status: 401 }
  );
}

// Cron endpoint - called by Railway scheduled task or external cron service
// MUST be protected by CRON_SECRET - requests without valid secret are rejected
export async function POST(request: Request) {
  // CRON_SECRET is required - reject if not configured
  if (!CRON_SECRET) {
    console.error("[CRON] SECURITY ERROR: CRON_SECRET is not configured!");
    return NextResponse.json(
      { error: "Server configuration error", message: "Cron secret not configured" },
      { status: 500 }
    );
  }

  // Verify cron secret from Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn("[CRON] Unauthorized access attempt from IP:", request.headers.get("x-forwarded-for") || "unknown");
    return unauthorizedResponse("Invalid or missing cron secret");
  }

  try {
    console.log("[CRON] Starting scheduled sync...");
    const startTime = Date.now();

    // Run full sync
    const result = await runFullSync();

    // Sync tournament details for active/recent tournaments
    const recentTournaments = await prisma.tournament.findMany({
      where: {
        status: { in: ["ACTIVE", "FINISHED"] },
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Updated in last 7 days
        },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });

    for (const tournament of recentTournaments) {
      try {
        await syncTournamentDetails(tournament.externalId);
      } catch (err) {
        console.error(`[CRON] Failed to sync details for ${tournament.externalId}:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Sync completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration,
      tournaments: result.tournaments,
      players: result.players,
      detailsSynced: recentTournaments.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Health check for cron monitoring - no auth required
export async function GET() {
  return NextResponse.json({
    status: "ok",
    cronSecretConfigured: !!CRON_SECRET,
    timestamp: new Date().toISOString(),
  });
}
