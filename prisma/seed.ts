import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Create sample players
  const players = await Promise.all([
    prisma.player.upsert({
      where: { lichessUsername: "noyd" },
      update: {},
      create: {
        lichessUsername: "nenna",
        name: "محمد فال",
        federation: "موريتانيا",
        lichessRapid: 1850,
        lichessBlitz: 1720,
        lichessClassical: 1650,
        lichessTitle: "NM",
        lichessSyncedAt: new Date(),
      },
    }),
    prisma.player.upsert({
      where: { lichessUsername: "sidi" },
      update: {},
      create: {
        lichessUsername: "sidi_cheikh",
        name: "سيدي الشيخ",
        federation: "موريتانيا",
        lichessRapid: 1780,
        lichessBlitz: 1650,
        lichessClassical: 1600,
        lichessSyncedAt: new Date(),
      },
    }),
    prisma.player.upsert({
      where: { lichessUsername: "eymane" },
      update: {},
      create: {
        lichessUsername: "eymane_mr",
        name: "إيمان",
        federation: "موريتانيا",
        lichessRapid: 1650,
        lichessBlitz: 1580,
        lichessClassical: 1500,
        lichessSyncedAt: new Date(),
      },
    }),
    prisma.player.upsert({
      where: { lichessUsername: "abdellahi" },
      update: {},
      create: {
        lichessUsername: "abdellahi_mr",
        name: "عبد الله محمد",
        federation: "موريتانيا",
        lichessRapid: 1820,
        lichessBlitz: 1750,
        lichessClassical: 1680,
        lichessSyncedAt: new Date(),
      },
    }),
    prisma.player.upsert({
      where: { lichessUsername: "malainin" },
      update: {},
      create: {
        lichessUsername: "malainin_mr",
        name: "ملاينين",
        federation: "موريتانيا",
        lichessRapid: 1700,
        lichessBlitz: 1620,
        lichessClassical: 1550,
        lichessSyncedAt: new Date(),
      },
    }),
    prisma.player.upsert({
      where: { lichessUsername: "abdahr" },
      update: {},
      create: {
        lichessUsername: "abdahr_mr",
        name: "عبد الخير",
        federation: "موريتانيا",
        lichessRapid: 1690,
        lichessBlitz: 1600,
        lichessClassical: 1520,
        lichessSyncedAt: new Date(),
      },
    }),
  ]);

  console.log(`Created ${players.length} players`);

  // Create a sample tournament
  const tournament = await prisma.tournament.upsert({
    where: { externalId: "MR-CH-2024-001" },
    update: {},
    create: {
      externalId: "MR-CH-2024-001",
      name: "بطولة موريتانيا للشطرنج 2024",
      location: "نواكشوط",
      startDate: new Date("2024-12-01"),
      endDate: new Date("2024-12-07"),
      status: "ACTIVE",
      federation: "موريتانيا",
      playerCount: 6,
      lastSynced: new Date(),
    },
  });

  console.log(`Created tournament: ${tournament.name}`);

  // Create tournament players
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    await prisma.tournamentPlayer.upsert({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId: player.id,
        },
      },
      update: {},
      create: {
        tournamentId: tournament.id,
        playerId: player.id,
        seed: i + 1,
        points: Math.max(0, 6 - i + Math.random() * 2),
        rank: i + 1,
        tiebreak1: Math.random() * 10,
        tiebreak2: Math.random() * 5,
      },
    });
  }

  // Create rounds with pairings
  const round1 = await prisma.round.upsert({
    where: {
      tournamentId_number: {
        tournamentId: tournament.id,
        number: 1,
      },
    },
    update: {},
    create: {
      tournamentId: tournament.id,
      number: 1,
      name: "الجولة الأولى",
      startTime: new Date("2024-12-01T10:00:00"),
    },
  });

  // Create pairings for round 1
  await prisma.pairing.createMany({
    data: [
      {
        roundId: round1.id,
        board: 1,
        whitePlayerId: players[0].id,
        blackPlayerId: players[1].id,
        result: "1-0",
      },
      {
        roundId: round1.id,
        board: 2,
        whitePlayerId: players[2].id,
        blackPlayerId: players[3].id,
        result: "0.5-0.5",
      },
      {
        roundId: round1.id,
        board: 3,
        whitePlayerId: players[4].id,
        blackPlayerId: players[5].id,
        result: "1-0",
      },
    ],
    skipDuplicates: true,
  });

  // Create round 2
  const round2 = await prisma.round.upsert({
    where: {
      tournamentId_number: {
        tournamentId: tournament.id,
        number: 2,
      },
    },
    update: {},
    create: {
      tournamentId: tournament.id,
      number: 2,
      name: "الجولة الثانية",
      startTime: new Date("2024-12-01T15:00:00"),
    },
  });

  await prisma.pairing.createMany({
    data: [
      {
        roundId: round2.id,
        board: 1,
        whitePlayerId: players[0].id,
        blackPlayerId: players[2].id,
        result: "1-0",
      },
      {
        roundId: round2.id,
        board: 2,
        whitePlayerId: players[1].id,
        blackPlayerId: players[4].id,
        result: "0.5-0.5",
      },
      {
        roundId: round2.id,
        board: 3,
        whitePlayerId: players[3].id,
        blackPlayerId: players[5].id,
        result: null, // Upcoming game
      },
    ],
    skipDuplicates: true,
  });

  // Create upcoming tournament
  await prisma.tournament.upsert({
    where: { externalId: "MR-CH-2025-001" },
    update: {},
    create: {
      externalId: "MR-CH-2025-001",
      name: "بطولة نواكشوط الشتوية 2025",
      location: "نواكشوط",
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-01-20"),
      status: "UPCOMING",
      federation: "موريتانيا",
      playerCount: 0,
      lastSynced: new Date(),
    },
  });

  // Create finished tournament
  await prisma.tournament.upsert({
    where: { externalId: "MR-CH-2024-PREV" },
    update: {},
    create: {
      externalId: "MR-CH-2024-PREV",
      name: "بطولة الخريف 2024",
      location: "نواكشوط",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2024-09-05"),
      status: "FINISHED",
      federation: "موريتانيا",
      playerCount: 24,
      lastSynced: new Date(),
    },
  });

  // Create a sync log
  await prisma.syncLog.create({
    data: {
      source: "chess-results",
      status: "success",
      itemsSynced: 3,
      completedAt: new Date(),
    },
  });

  console.log("Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
