import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry, getLastSyncTime } from "@/lib/database";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, getClientIP, getRateLimitHeaders } from "@/lib/rate-limit";
import type { LiveSearchResult } from "@/lib/api/types";

const MAX_QUERY_LENGTH = 100;

export async function GET(request: Request) {
  const clientIP = getClientIP(request);
  
  // Rate limit: 30 requests per minute per IP
  const rateLimit = checkRateLimit(clientIP, { windowMs: 60000, maxRequests: 30 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      errorResponse("تم تجاوز الحد الأقصى للطلبات، يرجى الانتظار", null),
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    let query = searchParams.get("q") || "";

    // Sanitize: limit query length to prevent abuse
    query = query.trim().slice(0, MAX_QUERY_LENGTH);

    if (!query || query.length < 2) {
      return NextResponse.json(
        successResponse({ results: [] }),
        { headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Sanitize: only allow alphanumeric, spaces, and common Arabic characters
    // This prevents potential injection while allowing Arabic text search
    const sanitizedQuery = query.replace(/[^\u0600-\u06FF\u0750-\u077F\w\s]/g, "");

    const [players, tournaments, lastSync] = await withRetry(async () =>
      Promise.all([
        prisma.player.findMany({
          where: {
            name: {
              contains: sanitizedQuery,
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
              contains: sanitizedQuery,
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
      successResponse({ results }),
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      errorResponse("فشل في البحث", { results: [] }),
      { status: 503, headers: getRateLimitHeaders(rateLimit) }
    );
  }
}
