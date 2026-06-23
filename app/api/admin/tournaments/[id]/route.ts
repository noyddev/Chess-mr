/**
 * Admin API - Tournament-specific Operations
 * 
 * Provides admin endpoints for:
 * - Force refresh a specific tournament
 * - View tournament snapshot
 * - View tournament sync status
 * - Trigger snapshot creation
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createSnapshot, getSyncStatusWithSnapshot, restoreFromSnapshot } from "@/services/sync/snapshot";
import { syncTournamentDetails } from "@/services/sync/orchestrator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "status";

    switch (action) {
      case "status": {
        const status = await getSyncStatusWithSnapshot(id);
        return NextResponse.json(status);
      }

      case "snapshot": {
        const snapshot = await prisma.tournamentSnapshot.findFirst({
          where: { tournamentId: id, isActive: true },
          orderBy: { snapshotTime: "desc" },
        });

        if (!snapshot) {
          return NextResponse.json(
            { error: "No active snapshot found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          id: snapshot.id,
          snapshotTime: snapshot.snapshotTime,
          source: snapshot.source,
          itemCount: snapshot.itemCount,
          isActive: snapshot.isActive,
        });
      }

      case "restore": {
        const result = await restoreFromSnapshot(id);
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          restoredAt: result.restoredAt,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: status, snapshot, restore" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Admin tournament error:", error);
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "refresh";

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { id: true, externalId: true, name: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "refresh": {
        // Sync tournament details from external source
        const syncResult = await syncTournamentDetails(tournament.externalId);
        
        // Create snapshot after sync
        const snapshotResult = await createSnapshot(id, "manual");

        return NextResponse.json({
          success: syncResult.success,
          sync: syncResult,
          snapshot: snapshotResult,
          tournament: {
            id: tournament.id,
            name: tournament.name,
          },
        });
      }

      case "snapshot": {
        // Create manual snapshot
        const result = await createSnapshot(id, "manual");

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          snapshotId: result.snapshotId,
        });
      }

      case "restore": {
        const result = await restoreFromSnapshot(id);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          restoredAt: result.restoredAt,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: refresh, snapshot, restore" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Admin tournament POST error:", error);
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
}
