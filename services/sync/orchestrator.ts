import prisma from "@/lib/db";
import { lichessClient } from "@/services/lichess/client";
import { tournamentScraper } from "@/services/scraper/chess-results";

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  error?: string;
  source: string;
}

/**
 * Sync tournaments from Chess-Results
 */
export async function syncTournaments(): Promise<SyncResult> {
  const startTime = new Date();
  
  try {
    const syncLog = await prisma.syncLog.create({
      data: {
        source: "chess-results",
        status: "pending",
        startedAt: startTime,
      },
    });

    // Scrape tournaments from Chess-Results
    const scrapedTournaments = await tournamentScraper.scrapeActiveTournaments();
    
    let itemsSynced = 0;

    for (const tournament of scrapedTournaments) {
      try {
        await prisma.tournament.upsert({
          where: { externalId: tournament.externalId },
          update: {
            name: tournament.name,
            location: tournament.location,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            status: tournament.status,
            playerCount: tournament.playerCount,
            lastSynced: new Date(),
          },
          create: {
            externalId: tournament.externalId,
            name: tournament.name,
            location: tournament.location,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            status: tournament.status,
            playerCount: tournament.playerCount,
          },
        });
        itemsSynced++;
      } catch (err) {
        console.error(`Failed to sync tournament ${tournament.externalId}:`, err);
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        itemsSynced,
        completedAt: new Date(),
      },
    });

    return { success: true, itemsSynced, source: "chess-results" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    await prisma.syncLog.create({
      data: {
        source: "chess-results",
        status: "failed",
        error: message,
        completedAt: new Date(),
      },
    });

    return { success: false, itemsSynced: 0, error: message, source: "chess-results" };
  }
}

/**
 * Sync player data from Lichess
 */
export async function syncPlayers(): Promise<SyncResult> {
  const startTime = new Date();
  
  try {
    const syncLog = await prisma.syncLog.create({
      data: {
        source: "lichess",
        status: "pending",
        startedAt: startTime,
      },
    });

    // Get players with Lichess usernames that haven't been synced recently
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const playersToSync = await prisma.player.findMany({
      where: {
        lichessUsername: { not: null },
        OR: [
          { lichessSyncedAt: null },
          { lichessSyncedAt: { lt: oneDayAgo } },
        ],
      },
      select: {
        id: true,
        lichessUsername: true,
      },
    });

    let itemsSynced = 0;

    // Process in batches of 50 (Lichess API limit)
    const batchSize = 50;
    for (let i = 0; i < playersToSync.length; i += batchSize) {
      const batch = playersToSync.slice(i, i + batchSize);
      const usernames = batch
        .map((p) => p.lichessUsername)
        .filter(Boolean) as string[];

      const lichessUsers = await lichessClient.getUsers(usernames);

      for (const lichessUser of lichessUsers) {
        const player = batch.find(
          (p) => p.lichessUsername === lichessUser.username.toLowerCase()
        );
        
        if (!player) continue;

        const ratings = lichessClient.extractRatings(lichessUser);

        await prisma.player.update({
          where: { id: player.id },
          data: {
            lichessRapid: ratings.rapid,
            lichessBlitz: ratings.blitz,
            lichessClassical: ratings.classical,
            lichessTitle: ratings.title,
            lichessLastSeen: new Date(lichessUser.seenAt),
            lichessSyncedAt: new Date(),
          },
        });

        itemsSynced++;
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        itemsSynced,
        completedAt: new Date(),
      },
    });

    return { success: true, itemsSynced, source: "lichess" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    await prisma.syncLog.create({
      data: {
        source: "lichess",
        status: "failed",
        error: message,
        completedAt: new Date(),
      },
    });

    return { success: false, itemsSynced: 0, error: message, source: "lichess" };
  }
}

/**
 * Get last sync times
 */
export async function getSyncStatus() {
  const [tournamentSync, playerSync] = await Promise.all([
    prisma.syncLog.findFirst({
      where: { source: "chess-results" },
      orderBy: { startedAt: "desc" },
    }),
    prisma.syncLog.findFirst({
      where: { source: "lichess" },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return {
    tournaments: tournamentSync
      ? {
          lastSync: tournamentSync.startedAt,
          status: tournamentSync.status,
          itemsSynced: tournamentSync.itemsSynced,
          error: tournamentSync.error,
        }
      : null,
    players: playerSync
      ? {
          lastSync: playerSync.startedAt,
          status: playerSync.status,
          itemsSynced: playerSync.itemsSynced,
          error: playerSync.error,
        }
      : null,
  };
}
