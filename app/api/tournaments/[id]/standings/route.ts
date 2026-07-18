import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api/response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        players: {
          orderBy: { rank: "asc" },
          include: {
            player: {
              select: {
                id: true,
                name: true,
                federation: true,
                lichessTitle: true,
                fideTitle: true,
                fideRating: true,
                lichessRapid: true,
                lichessBlitz: true,
                lichessClassical: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        errorResponse("البطولة غير موجودة", null),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse(
        {
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          lastSynced: tournament.lastSynced,
          players: tournament.players.map((entry) => ({
            id: entry.id,
            rank: entry.rank,
            points: entry.points,
            tiebreak1: entry.tiebreak1,
            tiebreak2: entry.tiebreak2,
            player: entry.player,
          })),
        },
        tournament.lastSynced
      )
    );
  } catch (error) {
    console.error("[STANDINGS_API_ERROR]", error);
    return NextResponse.json(
      errorResponse("فشل في جلب الترتيب", null),
      { status: 500 }
    );
  }
}
