import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry, getLastSyncTime } from "@/lib/database";
import { successResponse, errorResponse } from "@/lib/api/response";
import type { LiveSearchResult } from "@/lib/api/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json(
        successResponse({ results: [] })
      );
    }

    const [players, tournaments, lastSync] = await withRetry(async () =>
      Promise.all([
        prisma.player.findMany({
          where: {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          take: 5,
          select: {
            id: true,
            name: true,
            federation: true,
            lichessTitle: true,
            fideRating: true,
          },
        }),
        prisma.tournament.findMany({
          where: {
            name: {
              contains: query,
              mode: "insensitive",
            },
            status: {
              in: ["ACTIVE", "UPCOMING"],
            },
          },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            location: true,
          },
        }),
        getLastSyncTime(),
      ])
    );

    const results: LiveSearchResult[] = [
      ...players.map((p) => ({
        type: "player" as const,
        id: p.id,
        title: p.name,
        subtitle: p.federation,
        lichessTitle: p.lichessTitle || null,
        fideRating: p.fideRating || null,
      })),
      ...tournaments.map((t) => ({
        type: "tournament" as const,
        id: t.id,
        title: t.name,
        subtitle: t.location,
        status: t.status,
      })),
    ];

    return NextResponse.json(
      successResponse({ results })
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      errorResponse("فشل في البحث", { results: [] }),
      { status: 503 }
    );
  }
}
