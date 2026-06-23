import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry } from "@/lib/database";
import { successResponse, errorResponse } from "@/lib/api/response";
import type { TournamentDetails } from "@/lib/api/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await withRetry(() =>
      prisma.tournament.findUnique({
        where: { id },
        select: {
          id: true,
          externalId: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          status: true,
          federation: true,
          playerCount: true,
          lastSynced: true,
          players: {
            orderBy: { rank: "asc" },
            select: {
              id: true,
              seed: true,
              points: true,
              rank: true,
              tiebreak1: true,
              tiebreak2: true,
              tiebreak3: true,
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
          rounds: {
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              name: true,
              startTime: true,
              pairings: {
                orderBy: { board: "asc" },
                select: {
                  id: true,
                  board: true,
                  result: true,
                  whitePlayer: {
                    select: {
                      id: true,
                      name: true,
                      federation: true,
                      lichessTitle: true,
                      fideRating: true,
                      lichessRapid: true,
                    },
                  },
                  blackPlayer: {
                    select: {
                      id: true,
                      name: true,
                      federation: true,
                      lichessTitle: true,
                      fideRating: true,
                      lichessRapid: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    );

    if (!tournament) {
      return NextResponse.json(
        errorResponse("البطولة غير موجودة", null),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse(tournament, tournament.lastSynced)
    );
  } catch (error) {
    console.error("Tournament fetch error:", error);
    return NextResponse.json(
      errorResponse("فشل في الاتصال بقاعدة البيانات", null),
      { status: 503 }
    );
  }
}
