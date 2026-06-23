import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { PlayerProfile } from "@/lib/api/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const player = await prisma.player.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        federation: true,
        lichessUsername: true,
        lichessTitle: true,
        fideId: true,
        fideTitle: true,
        fideRating: true,
        lichessRapid: true,
        lichessBlitz: true,
        lichessClassical: true,
        lichessLastSeen: true,
        tournaments: {
          orderBy: {
            tournament: {
              startDate: "desc",
            },
          },
          take: 10,
          select: {
            points: true,
            rank: true,
            tournament: {
              select: {
                id: true,
                name: true,
                location: true,
                startDate: true,
                endDate: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "اللاعب غير موجود" },
        { status: 404 }
      );
    }

    // Calculate stats
    const stats = player.tournaments.length > 0
      ? {
          totalTournaments: player.tournaments.length,
          wins: player.tournaments.filter((t) => t.rank === 1).length,
          draws: 0,
          losses: 0,
          averageScore: player.tournaments.reduce((sum, t) => sum + t.points, 0) / player.tournaments.length,
        }
      : null;

    const response: PlayerProfile = {
      ...player,
      tournaments: player.tournaments.map((t) => ({
        id: t.tournament.id,
        name: t.tournament.name,
        location: t.tournament.location,
        startDate: t.tournament.startDate,
        endDate: t.tournament.endDate,
        status: t.tournament.status,
        points: t.points,
        rank: t.rank,
      })),
      stats,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Player fetch error:", error);
    return NextResponse.json(
      { error: "فشل في جلب بيانات اللاعب" },
      { status: 500 }
    );
  }
}
