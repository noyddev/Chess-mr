import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry } from "@/lib/database";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, getClientIP, getRateLimitHeaders } from "@/lib/rate-limit";
import type { TournamentDetails } from "@/lib/api/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = getClientIP(request);
  
  // Rate limit: 60 requests per minute per IP
  const rateLimit = checkRateLimit(clientIP, { windowMs: 60000, maxRequests: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      errorResponse("تم تجاوز الحد الأقصى للطلبات", null),
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

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
                  isBye: true,
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
        { status: 404, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    return NextResponse.json(
      successResponse(tournament, tournament.lastSynced),
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("Tournament fetch error:", error);
    return NextResponse.json(
      errorResponse("فشل في الاتصال بقاعدة البيانات", null),
      { status: 503, headers: getRateLimitHeaders(rateLimit) }
    );
  }
}
