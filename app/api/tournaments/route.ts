import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withRetry } from "@/lib/database";
import type { TournamentListItem, PaginatedResponse } from "@/lib/api/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
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

    const [tournaments, total] = await withRetry(async () =>
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Tournaments fetch error:", error);
    return NextResponse.json(
      { error: "فشل في جلب البطولات", data: [], pagination: null },
      { status: 500 }
    );
  }
}
