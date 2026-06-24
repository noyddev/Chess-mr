import prisma from "@/lib/db";
import { lichessClient } from "@/services/lichess/client";

/**
 * Sync all Mauritanian Lichess players
 * Discovers players from Mauritania (country code: MR) on Lichess
 * and creates/updates their profiles with ratings
 */
export async function syncMauritanianLichessPlayers(): Promise<{ 
  synced: number; 
  skipped: number 
}> {
  let syncedCount = 0;
  let skippedCount = 0;
  
  try {
    // Get list of Mauritanian players from Lichess
    const mauritanianPlayers = await lichessClient.getPlayersByCountry("MR", 200);
    console.log(`[MAURITANIA] Found ${mauritanianPlayers.length} Mauritanian players on Lichess`);
    
    if (mauritanianPlayers.length === 0) {
      console.log("[MAURITANIA] No Mauritanian players found on Lichess");
      return { synced: syncedCount, skipped: skippedCount };
    }
    
    // Process in batches to respect rate limits
    const batchSize = 30;
    for (let i = 0; i < mauritanianPlayers.length; i += batchSize) {
      const batch = mauritanianPlayers.slice(i, i + batchSize);
      
      try {
        const lichessUsers = await lichessClient.getUsers(batch);
        
        for (const lichessUser of lichessUsers) {
          try {
            const ratings = lichessClient.extractRatings(lichessUser);
            
            // Check if player already exists
            const existing = await prisma.player.findFirst({
              where: { 
                OR: [
                  { lichessUsername: lichessUser.username.toLowerCase() },
                  { fideId: lichessUser.id }
                ]
              }
            });
            
            if (!existing) {
              // Create new player
              await prisma.player.create({
                data: {
                  lichessUsername: lichessUser.username,
                  name: lichessUser.username,
                  federation: "Mauritania",
                  fideId: lichessUser.id,
                  lichessRapid: ratings.rapid,
                  lichessBlitz: ratings.blitz,
                  lichessClassical: ratings.classical,
                  lichessTitle: ratings.title,
                  lichessLastSeen: new Date(lichessUser.seenAt || Date.now()),
                  lichessSyncedAt: new Date(),
                },
              });
              syncedCount++;
              console.log(`[MAURITANIA] Created player: ${lichessUser.username}`);
            } else {
              // Update existing player
              await prisma.player.update({
                where: { id: existing.id },
                data: {
                  lichessUsername: lichessUser.username,
                  lichessRapid: ratings.rapid,
                  lichessBlitz: ratings.blitz,
                  lichessClassical: ratings.classical,
                  lichessTitle: ratings.title,
                  lichessLastSeen: new Date(lichessUser.seenAt || Date.now()),
                  lichessSyncedAt: new Date(),
                },
              });
              syncedCount++;
            }
          } catch (err) {
            console.error(`[MAURITANIA] Error syncing ${lichessUser.username}:`, err);
            skippedCount++;
          }
        }
      } catch (err) {
        console.error(`[MAURITANIA] Batch error at ${i}:`, err);
        skippedCount += batch.length;
      }
    }
  } catch (err) {
    console.error("[MAURITANIA] Error fetching Mauritanian players:", err);
  }
  
  console.log(`[MAURITANIA] Sync complete: ${syncedCount} synced, ${skippedCount} skipped`);
  return { synced: syncedCount, skipped: skippedCount };
}
