/**
 * Admin API - Manual Sync Control
 * 
 * Provides admin endpoints for:
 * - Triggering manual sync
 * - Viewing sync logs
 * - Force refreshing specific tournaments
 * - Viewing snapshot state
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncTournaments, syncPlayers, runFullSync, syncAllTournamentDetails } from "@/services/sync/orchestrator";
import { createSnapshot, getSyncStatusWithSnapshot } from "@/services/sync/snapshot";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "sync-all";
    const source = searchParams.get("source");

    let result;
    
    switch (action) {
      case "sync-tournaments":
        result = await syncTournaments();
        break;
      case "sync-players":
        result = await syncPlayers();
        break;
      case "sync-all":
        result = await runFullSync();
        break;
      case "sync-tournament-details":
        // Sync details (players, standings, rounds) for all tournaments
        result = await syncAllTournamentDetails();
        break;
      case "snapshot-all":
        // Create snapshots for all active tournaments
        const activeTournaments = await prisma.tournament.findMany({
          where: { status: "ACTIVE" },
          select: { id: true },
        });
        
        const snapshotResults = await Promise.all(
          activeTournaments.map((t) => createSnapshot(t.id, "manual"))
        );
        
        result = {
          success: snapshotResults.every((r) => r.success),
          itemsSynced: snapshotResults.filter((r) => r.success).length,
          failed: snapshotResults.filter((r) => !r.success).length,
          source: "snapshot",
        };
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action. Use: sync-tournaments, sync-players, sync-all, sync-tournament-details, snapshot-all" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin sync error:", error);
    return NextResponse.json(
      { error: "Sync operation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get recent sync logs
    const recentLogs = await prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    // Get sync statistics
    const stats = await prisma.syncLog.groupBy({
      by: ["source", "status"],
      _count: true,
      _sum: {
        itemsSynced: true,
        skipped: true,
      },
    });

    // Get active tournaments count
    const tournamentCounts = await prisma.tournament.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get player count
    const playerCount = await prisma.player.count();

    // Get snapshot stats
    const snapshotStats = await prisma.tournamentSnapshot.groupBy({
      by: ["source"],
      _count: true,
      where: { isActive: true },
    });

    return NextResponse.json({
      recentLogs,
      stats,
      tournaments: {
        total: await prisma.tournament.count(),
        byStatus: tournamentCounts.reduce((acc, t) => {
          acc[t.status] = t._count;
          return acc;
        }, {} as Record<string, number>),
      },
      players: { total: playerCount },
      snapshots: {
        active: snapshotStats.reduce((sum, s) => sum + s._count, 0),
        bySource: snapshotStats.reduce((acc, s) => {
          acc[s.source] = s._count;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error("Admin status error:", error);
    return NextResponse.json(
      { error: "Failed to get admin status" },
      { status: 500 }
    );
  }
}
