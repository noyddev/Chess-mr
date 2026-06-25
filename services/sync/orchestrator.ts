import prisma from "@/lib/db";
import { lichessClient } from "@/services/lichess/client";
import { tournamentScraper } from "@/services/scraper/chess-results";
import { syncMauritanianLichessPlayers } from "./syncMauritania";

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  error?: string;
  source: string;
  skipped?: number;
}

// Sync intervals in milliseconds
const ACTIVE_TOURNAMENT_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const FINISHED_TOURNAMENT_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const PLAYER_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if tournament sync should run based on last sync time
 */
async function shouldSyncTournaments(): Promise<{
  shouldSync: boolean;
  isActiveSync: boolean;
}> {
  const lastSync = await prisma.syncLog.findFirst({
    where: { source: "chess-results", status: "success" },
    orderBy: { completedAt: "desc" },
  });

  if (!lastSync || !lastSync.completedAt) {
    return { shouldSync: true, isActiveSync: true };
  }

  const timeSinceLastSync = Date.now() - lastSync.completedAt.getTime();
  
  // Always sync active tournaments every 5 minutes
  if (timeSinceLastSync >= ACTIVE_TOURNAMENT_SYNC_INTERVAL) {
    return { shouldSync: true, isActiveSync: true };
  }

  // Check if we need to sync finished tournaments (every 24 hours)
  if (timeSinceLastSync >= FINISHED_TOURNAMENT_SYNC_INTERVAL) {
    return { shouldSync: true, isActiveSync: false };
  }

  return { shouldSync: false, isActiveSync: false };
}

/**
 * Sync tournaments from Chess-Results with retry logic
 */
export async function syncTournaments(): Promise<SyncResult> {
  const startTime = new Date();
  let syncLogId: string | null = null;
  
  try {
    const syncLog = await prisma.syncLog.create({
      data: {
        source: "chess-results",
        status: "pending",
        startedAt: startTime,
      },
    });
    syncLogId = syncLog.id;

    // Scrape tournaments from Chess-Results with retry
    let scrapedTournaments: Awaited<ReturnType<typeof tournamentScraper.scrapeActiveTournaments>> = [];
    let scrapeError: string | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        scrapedTournaments = await tournamentScraper.scrapeActiveTournaments();
        scrapeError = null;
        break;
      } catch (err) {
        scrapeError = err instanceof Error ? err.message : "Unknown scrape error";
        console.error(`Scrape attempt ${attempt} failed:`, err);
        
        if (attempt < 3) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    // If all scrape attempts failed, use cached data
    if (scrapeError && scrapedTournaments.length === 0) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "failed",
          error: `All scrape attempts failed: ${scrapeError}. Using cached data.`,
          completedAt: new Date(),
        },
      });

      return { 
        success: false, 
        itemsSynced: 0, 
        error: scrapeError,
        source: "chess-results",
        skipped: 0 
      };
    }

    let itemsSynced = 0;
    let skipped = 0;

    for (const tournament of scrapedTournaments) {
      try {
        const existing = await prisma.tournament.findUnique({
          where: { externalId: tournament.externalId },
          select: { id: true, name: true, lastSynced: true }
        });

        // Never overwrite valid data with empty/zero values
        const playerCount = tournament.playerCount || existing 
          ? (await prisma.tournament.findUnique({ 
              where: { externalId: tournament.externalId },
              select: { playerCount: true }
            }))?.playerCount || 0
          : 0;

        await prisma.tournament.upsert({
          where: { externalId: tournament.externalId },
          update: {
            name: tournament.name,
            location: tournament.location,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            status: tournament.status,
            playerCount: playerCount,
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
        skipped++;
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: "success",
        itemsSynced,
        skipped,
        completedAt: new Date(),
      },
    });

    return { success: true, itemsSynced, skipped, source: "chess-results" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    if (syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "failed",
          error: message,
          completedAt: new Date(),
        },
      });
    }

    return { success: false, itemsSynced: 0, error: message, source: "chess-results" };
  }
}

/**
 * Sync player data from Lichess with batch processing and retry
 */
export async function syncPlayers(): Promise<SyncResult> {
  const startTime = new Date();
  let syncLogId: string | null = null;
  try {
    // Step 1: Sync all Mauritanian Lichess players
    syncMauritanianLichessPlayers().catch(err => {
      console.error("[SYNC] Mauritania sync failed:", err);
    });

    const syncLog = await prisma.syncLog.create({
      data: {
        source: "lichess",
        status: "pending",
        startedAt: startTime,
      },
    });
    syncLogId = syncLog.id;

    // Get players with Lichess usernames that haven't been synced recently
    const oneDayAgo = new Date(Date.now() - PLAYER_SYNC_INTERVAL);
    
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

    if (playersToSync.length === 0) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "success",
          itemsSynced: 0,
          completedAt: new Date(),
        },
      });

      return { success: true, itemsSynced: 0, source: "lichess" };
    }

    let itemsSynced = 0;
    let skipped = 0;

    // Process in batches of 30 (conservative for rate limiting)
    const batchSize = 30;
    for (let i = 0; i < playersToSync.length; i += batchSize) {
      const batch = playersToSync.slice(i, i + batchSize);
      const usernames = batch
        .map((p) => p.lichessUsername)
        .filter(Boolean) as string[];

      try {
        const lichessUsers = await lichessClient.getUsers(usernames);

        for (const lichessUser of lichessUsers) {
          const player = batch.find(
            (p) => p.lichessUsername?.toLowerCase() === lichessUser.username.toLowerCase()
          );
          
          if (!player) {
            skipped++;
            continue;
          }

          const ratings = lichessClient.extractRatings(lichessUser);

          // Only update if we have valid data from Lichess
          const updateData: Record<string, unknown> = {
            lichessLastSeen: new Date(lichessUser.seenAt),
            lichessSyncedAt: new Date(),
          };

          if (ratings.rapid !== null) updateData.lichessRapid = ratings.rapid;
          if (ratings.blitz !== null) updateData.lichessBlitz = ratings.blitz;
          if (ratings.classical !== null) updateData.lichessClassical = ratings.classical;
          if (ratings.title !== null) updateData.lichessTitle = ratings.title;

          await prisma.player.update({
            where: { id: player.id },
            data: updateData,
          });

          itemsSynced++;
        }
      } catch (err) {
        console.error(`Batch sync error at offset ${i}:`, err);
        skipped += batch.length;
        
        // Continue with next batch instead of failing completely
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: "success",
        itemsSynced,
        skipped,
        completedAt: new Date(),
      },
    });

    return { success: true, itemsSynced, skipped, source: "lichess" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    if (syncLogId) {
      await prisma.syncLog.create({
        data: {
          source: "lichess",
          status: "failed",
          error: message,
          completedAt: new Date(),
        },
      });
    }

    return { success: false, itemsSynced: 0, error: message, source: "lichess" };
  }
}

/**
 * Sync a specific tournament's detailed data
 */
export async function syncTournamentDetails(externalId: string): Promise<SyncResult> {
  try {
    const details = await tournamentScraper.scrapeTournamentDetails(externalId);
    
    if (!details) {
      return { success: false, itemsSynced: 0, error: "Failed to scrape details", source: "chess-results" };
    }

    const tournament = await prisma.tournament.findUnique({
      where: { externalId },
      include: { players: true, rounds: true }
    });

    if (!tournament) {
      return { success: false, itemsSynced: 0, error: "Tournament not found", source: "chess-results" };
    }

    // Build a map of player names to their database records for pairing resolution
    const allPlayers = await prisma.player.findMany({
      where: {
        tournaments: {
          some: { tournamentId: tournament.id }
        }
      },
      select: { id: true, name: true }
    });
    const playerNameToId = new Map(allPlayers.map(p => [p.name.toLowerCase(), p.id]));

    // Update tournament with dates if available
    const updateData: Record<string, unknown> = {
      playerCount: details.players.length,
      lastSynced: new Date(),
    };
    if (details.startDate) {
      updateData.startDate = details.startDate;
    }
    if (details.endDate) {
      updateData.endDate = details.endDate;
    }
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: updateData,
    });

    // Sync players
    let itemsSynced = 0;
    for (const scrapedPlayer of details.players) {
      try {
        // Try to find player by FIDE ID first, then by name
        let player = scrapedPlayer.fideId 
          ? await prisma.player.findFirst({ where: { fideId: scrapedPlayer.fideId } })
          : null;
        
        if (!player) {
          player = await prisma.player.findFirst({
            where: { name: scrapedPlayer.name }
          });
        }

        if (!player && scrapedPlayer.name) {
          player = await prisma.player.create({
            data: {
              name: scrapedPlayer.name,
              federation: scrapedPlayer.federation || "موريتانيا",
              fideId: scrapedPlayer.fideId || null,
            }
          });
        }

        if (player && tournament.id) {
          // Update player with FIDE ID if we have it and player doesn't
          const updateData: Record<string, unknown> = {};
          if (scrapedPlayer.fideId && !player.fideId) {
            updateData.fideId = scrapedPlayer.fideId;
          }
          if (scrapedPlayer.rating && scrapedPlayer.rating > 0) {
            updateData.fideRating = scrapedPlayer.rating;
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.player.update({
              where: { id: player.id },
              data: updateData,
            });
          }

          // Create or update tournament player record
          await prisma.tournamentPlayer.upsert({
            where: {
              tournamentId_playerId: {
                tournamentId: tournament.id,
                playerId: player.id,
              }
            },
            update: {
              seed: scrapedPlayer.seed,
              points: scrapedPlayer.points || 0,
              rank: scrapedPlayer.rank,
            },
            create: {
              tournamentId: tournament.id,
              playerId: player.id,
              seed: scrapedPlayer.seed,
              points: scrapedPlayer.points || 0,
              rank: scrapedPlayer.rank,
            }
          });
          
          itemsSynced++;
        }
      } catch (err) {
        console.error(`Failed to sync player ${scrapedPlayer.name}:`, err);
      }
    }

    // Sync rounds and pairings
    for (const scrapedRound of details.rounds) {
      try {
        const round = await prisma.round.upsert({
          where: {
            tournamentId_number: {
              tournamentId: tournament.id,
              number: scrapedRound.number,
            }
          },
          update: {
            name: scrapedRound.name,
            startTime: scrapedRound.startTime,
          },
          create: {
            tournamentId: tournament.id,
            number: scrapedRound.number,
            name: scrapedRound.name,
            startTime: scrapedRound.startTime,
          }
        });

        // Sync pairings for this round
        for (const scrapedPairing of scrapedRound.pairings) {
          try {
            const whitePlayerId = scrapedPairing.whitePlayer 
              ? playerNameToId.get(scrapedPairing.whitePlayer.toLowerCase())
              : null;
            const blackPlayerId = scrapedPairing.blackPlayer 
              ? playerNameToId.get(scrapedPairing.blackPlayer.toLowerCase())
              : null;

            if (whitePlayerId || blackPlayerId) {
              await prisma.pairing.create({
                data: {
                  roundId: round.id,
                  board: scrapedPairing.board,
                  whitePlayerId,
                  blackPlayerId,
                  result: scrapedPairing.result,
                }
              });
            }
          } catch (err) {
            console.error(`Failed to sync pairing:`, err);
          }
        }
      } catch (err) {
        console.error(`Failed to sync round ${scrapedRound.number}:`, err);
      }
    }

    // Update tournament player count
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { 
        playerCount: details.players.length,
        lastSynced: new Date(),
      }
    });

    return { success: true, itemsSynced, source: "chess-results" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, itemsSynced: 0, error: message, source: "chess-results" };
  }
}

/**
 * Get last sync times and status
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
          completedAt: tournamentSync.completedAt,
          status: tournamentSync.status,
          itemsSynced: tournamentSync.itemsSynced,
          skipped: tournamentSync.skipped,
          error: tournamentSync.error,
        }
      : null,
    players: playerSync
      ? {
          lastSync: playerSync.startedAt,
          completedAt: playerSync.completedAt,
          status: playerSync.status,
          itemsSynced: playerSync.itemsSynced,
          skipped: playerSync.skipped,
          error: playerSync.error,
        }
      : null,
  };
}

/**
 * Sync details for all tournaments (players, standings, rounds)
 */
export async function syncAllTournamentDetails(): Promise<{
  success: boolean;
  itemsSynced: number;
  failed: number;
  source: string;
}> {
  const startTime = new Date();
  let syncLogId: string | null = null;

  try {
    const syncLog = await prisma.syncLog.create({
      data: {
        source: "chess-results-details",
        status: "pending",
        startedAt: startTime,
      },
    });
    syncLogId = syncLog.id;

    // Get all tournaments with their externalIds
    const tournaments = await prisma.tournament.findMany({
      select: { id: true, externalId: true, name: true },
      orderBy: { startDate: "desc" },
    });

    console.log(`[SYNC] Syncing details for ${tournaments.length} tournaments...`);

    let itemsSynced = 0;
    let failed = 0;

    for (const tournament of tournaments) {
      try {
        const result = await syncTournamentDetails(tournament.externalId);
        if (result.success) {
          itemsSynced++;
        } else {
          failed++;
          console.error(`[SYNC] Failed to sync ${tournament.name}: ${result.error}`);
        }
      } catch (err) {
        failed++;
        console.error(`[SYNC] Error syncing ${tournament.name}:`, err);
      }

      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: failed === 0 ? "success" : failed < itemsSynced ? "partial" : "failed",
        itemsSynced,
        skipped: failed,
        completedAt: new Date(),
      },
    });

    return { success: failed === 0, itemsSynced, failed, source: "chess-results-details" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: { status: "failed", error: message, completedAt: new Date() },
      });
    }

    return { success: false, itemsSynced: 0, failed: 0, source: "chess-results-details" };
  }
}

/**
 * Run full sync (tournaments + players)
 */
export async function runFullSync(): Promise<{
  tournaments: SyncResult;
  players: SyncResult;
}> {
  const [tournaments, players] = await Promise.all([
    syncTournaments(),
    syncPlayers(),
  ]);

  return { tournaments, players };
}
