import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry, getLastSyncTime } from "@/lib/database";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, getClientIP, getRateLimitHeaders } from "@/lib/rate-limit";
import type { TournamentListItem, PaginatedResponse } from "@/lib/api/types";

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") || "startDate";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status && ["UPCOMING", "ACTIVE", "FINISHED"].includes(status)) {
      where.status = status;
    }

    const orderBy: Record<string, string> = {};
    switch (sort) {
      case "name":
        orderBy.name = "asc";
        break;
      case "playerCount":
        orderBy.playerCount = "desc";
        break;
      default:
        orderBy.startDate = "desc";
    }

    const [tournaments, total, lastSync] = await withRetry(async () =>
      Promise.all([
        prisma.tournament.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            location: true,
            startDate: true,
            endDate: true,
            status: true,
            playerCount: true,
            federation: true,
          },
        }),
        prisma.tournament.count({ where }),
        getLastSyncTime(),
      ])
    );

    const response: PaginatedResponse<TournamentListItem> = {
      data: tournaments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(
      successResponse(response, lastSync),
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("Tournaments fetch error:", error);
    return NextResponse.json(
      errorResponse("فشل في الاتصال بقاعدة البيانات", null),
      { status: 503, headers: getRateLimitHeaders(rateLimit) }
    );
  }
}
