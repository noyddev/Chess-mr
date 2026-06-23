/**
 * Tournament Snapshot Service
 * 
 * Handles creating, managing, and restoring tournament snapshots.
 * Snapshots are used as fallback when live sync fails.
 */

import prisma from "@/lib/db";

export interface SnapshotData {
  standings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    points: number;
    tiebreak1?: number;
    tiebreak2?: number;
  }>;
  rounds: Array<{
    number: number;
    name?: string;
    startTime?: string;
    pairings: Array<{
      board: number;
      whitePlayerId?: string;
      whitePlayerName?: string;
      blackPlayerId?: string;
      blackPlayerName?: string;
      result?: string;
    }>;
  }>;
  meta?: {
    totalPlayers?: number;
    currentRound?: number;
    lastUpdated?: string;
  };
}

/**
 * Create a snapshot of tournament data
 */
export async function createSnapshot(
  tournamentId: string,
  source: string = "chess-results"
): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
  try {
    // Get tournament with all related data
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        players: {
          orderBy: { rank: "asc" },
          include: {
            player: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        rounds: {
          orderBy: { number: "asc" },
          include: {
            pairings: {
              include: {
                whitePlayer: {
                  select: { id: true, name: true },
                },
                blackPlayer: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return { success: false, error: "Tournament not found" };
    }

    // Build snapshot data
    const snapshotData: SnapshotData = {
      standings: tournament.players.map((tp) => ({
        rank: tp.rank || 0,
        playerId: tp.player.id,
        playerName: tp.player.name,
        points: tp.points,
        tiebreak1: tp.tiebreak1 || undefined,
        tiebreak2: tp.tiebreak2 || undefined,
      })),
      rounds: tournament.rounds.map((r) => ({
        number: r.number,
        name: r.name || undefined,
        startTime: r.startTime?.toISOString(),
        pairings: r.pairings.map((p) => ({
          board: p.board || 0,
          whitePlayerId: p.whitePlayerId || undefined,
          whitePlayerName: p.whitePlayer?.name,
          blackPlayerId: p.blackPlayerId || undefined,
          blackPlayerName: p.blackPlayer?.name,
          result: p.result || undefined,
        })),
      })),
      meta: {
        totalPlayers: tournament.playerCount,
        currentRound: tournament.rounds.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    // Mark all existing snapshots as inactive
    await prisma.tournamentSnapshot.updateMany({
      where: { tournamentId, isActive: true },
      data: { isActive: false },
    });

    // Create new snapshot
    const snapshot = await prisma.tournamentSnapshot.create({
      data: {
        tournamentId,
        source,
        isActive: true,
        standingsJson: JSON.stringify(snapshotData.standings),
        pairingsJson: JSON.stringify(snapshotData.rounds),
        roundsJson: JSON.stringify(snapshotData.rounds.map((r) => ({ number: r.number, name: r.name, startTime: r.startTime }))),
        metaJson: JSON.stringify(snapshotData.meta),
        itemCount: tournament.players.length + tournament.rounds.reduce((sum, r) => sum + r.pairings.length, 0),
      },
    });

    // Clean up old snapshots (keep last 10)
    await cleanupOldSnapshots(tournamentId, 10);

    return { success: true, snapshotId: snapshot.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create snapshot:", error);
    return { success: false, error: message };
  }
}

/**
 * Get the current active snapshot for a tournament
 */
export async function getActiveSnapshot(tournamentId: string) {
  return prisma.tournamentSnapshot.findFirst({
    where: { tournamentId, isActive: true },
    orderBy: { snapshotTime: "desc" },
  });
}

/**
 * Get snapshot data as parsed object
 */
export async function getSnapshotData(tournamentId: string): Promise<SnapshotData | null> {
  const snapshot = await getActiveSnapshot(tournamentId);
  
  if (!snapshot) return null;

  try {
    return {
      standings: snapshot.standingsJson ? JSON.parse(snapshot.standingsJson) : [],
      rounds: snapshot.pairingsJson ? JSON.parse(snapshot.pairingsJson) : [],
      meta: snapshot.metaJson ? JSON.parse(snapshot.metaJson) : undefined,
    };
  } catch {
    console.error("Failed to parse snapshot data");
    return null;
  }
}

/**
 * Restore tournament from snapshot
 * Used when live data is unavailable
 */
export async function restoreFromSnapshot(
  tournamentId: string
): Promise<{ success: boolean; restoredAt?: Date; error?: string }> {
  try {
    const snapshot = await getActiveSnapshot(tournamentId);
    
    if (!snapshot) {
      return { success: false, error: "No snapshot available" };
    }

    const snapshotData = await getSnapshotData(tournamentId);
    
    if (!snapshotData) {
      return { success: false, error: "Invalid snapshot data" };
    }

    // Use a transaction to restore data
    await prisma.$transaction(async (tx) => {
      // Restore standings (TournamentPlayer records)
      for (const standing of snapshotData.standings) {
        const player = await tx.player.findFirst({
          where: { name: standing.playerName },
        });

        if (player) {
          await tx.tournamentPlayer.upsert({
            where: {
              tournamentId_playerId: {
                tournamentId,
                playerId: player.id,
              },
            },
            update: {
              rank: standing.rank,
              points: standing.points,
              tiebreak1: standing.tiebreak1,
              tiebreak2: standing.tiebreak2,
            },
            create: {
              tournamentId,
              playerId: player.id,
              rank: standing.rank,
              points: standing.points,
              tiebreak1: standing.tiebreak1,
              tiebreak2: standing.tiebreak2,
            },
          });
        }
      }

      // Restore rounds and pairings
      for (const roundData of snapshotData.rounds) {
        const round = await tx.round.upsert({
          where: {
            tournamentId_number: {
              tournamentId,
              number: roundData.number,
            },
          },
          update: {
            name: roundData.name,
            startTime: roundData.startTime ? new Date(roundData.startTime) : null,
            snapshotId: snapshot.id,
          },
          create: {
            tournamentId,
            number: roundData.number,
            name: roundData.name,
            startTime: roundData.startTime ? new Date(roundData.startTime) : null,
            snapshotId: snapshot.id,
          },
        });

        // Restore pairings
        for (const pairing of roundData.pairings) {
          let whitePlayerId: string | null = null;
          let blackPlayerId: string | null = null;

          if (pairing.whitePlayerName) {
            const white = await tx.player.findFirst({
              where: { name: pairing.whitePlayerName },
            });
            whitePlayerId = white?.id || null;
          }

          if (pairing.blackPlayerName) {
            const black = await tx.player.findFirst({
              where: { name: pairing.blackPlayerName },
            });
            blackPlayerId = black?.id || null;
          }

          await tx.pairing.upsert({
            where: { id: `${round.id}-${pairing.board}` },
            update: {
              board: pairing.board,
              whitePlayerId,
              blackPlayerId,
              result: pairing.result,
            },
            create: {
              id: `${round.id}-${pairing.board}`,
              roundId: round.id,
              board: pairing.board,
              whitePlayerId,
              blackPlayerId,
              result: pairing.result,
            },
          });
        }
      }

      // Update tournament metadata
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          lastSynced: snapshot.snapshotTime,
          updatedAt: new Date(),
        },
      });
    });

    return { success: true, restoredAt: snapshot.snapshotTime };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to restore from snapshot:", error);
    return { success: false, error: message };
  }
}

/**
 * Clean up old snapshots, keeping only the most recent ones
 */
async function cleanupOldSnapshots(tournamentId: string, keepCount: number): Promise<void> {
  const oldSnapshots = await prisma.tournamentSnapshot.findMany({
    where: { tournamentId, isActive: false },
    orderBy: { snapshotTime: "desc" },
    skip: keepCount,
    select: { id: true },
  });

  if (oldSnapshots.length > 0) {
    await prisma.tournamentSnapshot.deleteMany({
      where: {
        id: { in: oldSnapshots.map((s) => s.id) },
      },
    });
  }
}

/**
 * Check if tournament data is stale (older than threshold)
 */
export async function isDataStale(
  tournamentId: string,
  maxAgeMinutes: number = 30
): Promise<{ isStale: boolean; lastSync?: Date; minutesOld?: number }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { lastSynced: true, status: true },
  });

  if (!tournament || !tournament.lastSynced) {
    return { isStale: true };
  }

  const now = new Date();
  const ageMs = now.getTime() - tournament.lastSynced.getTime();
  const ageMinutes = ageMs / (1000 * 60);

  // Active tournaments should be synced more frequently
  if (tournament.status === "ACTIVE" && ageMinutes > maxAgeMinutes) {
    return { isStale: true, lastSync: tournament.lastSynced, minutesOld: ageMinutes };
  }

  // Finished tournaments can be older
  if (tournament.status === "FINISHED" && ageMinutes > maxAgeMinutes * 12) {
    return { isStale: true, lastSync: tournament.lastSynced, minutesOld: ageMinutes };
  }

  return { isStale: false, lastSync: tournament.lastSynced, minutesOld: ageMinutes };
}

/**
 * Get sync status with snapshot info
 */
export async function getSyncStatusWithSnapshot(tournamentId: string) {
  const [tournament, latestSnapshot, latestSync] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { status: true, lastSynced: true, playerCount: true },
    }),
    getActiveSnapshot(tournamentId),
    prisma.syncLog.findFirst({
      where: { source: "chess-results", status: { in: ["success", "partial"] } },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  return {
    tournamentStatus: tournament?.status,
    lastSynced: tournament?.lastSynced,
    playerCount: tournament?.playerCount,
    hasSnapshot: !!latestSnapshot,
    snapshotTime: latestSnapshot?.snapshotTime,
    lastSuccessfulSync: latestSync?.completedAt,
    syncStatus: latestSync?.status,
  };
}
