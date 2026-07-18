import { NextResponse } from "next/server";
import { runFullSync, syncTournamentDetails } from "@/services/sync/orchestrator";
import prisma from "@/lib/db";

// Cron endpoint - called by Railway scheduled task or external cron service
// Protected by CRON_SECRET to prevent unauthorized triggers
export async function POST(request: Request) {
  // Verify cron secret (set in Railway environment)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  // Only enforce auth if CRON_SECRET is explicitly configured (non-empty string)
  if (expectedSecret && expectedSecret.length > 0 && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

// Health check for cron monitoring
export async function GET() {
  return NextResponse.json({
    status: "ok",
    cronSecretConfigured: !!process.env.CRON_SECRET,
    timestamp: new Date().toISOString(),
  });
}
