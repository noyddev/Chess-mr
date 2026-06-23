import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry } from "@/lib/database";
import type { LiveSearchResult } from "@/lib/api/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const [players, tournaments] = await withRetry(async () =>
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

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "فشل في البحث", results: [] },
      { status: 500 }
    );
  }
}
