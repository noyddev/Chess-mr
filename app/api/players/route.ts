import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { PlayerListItem, PaginatedResponse } from "@/lib/api/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "name";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const orderBy: Record<string, string>[] = [];
    switch (sort) {
      case "rating":
        orderBy.push({ fideRating: "desc" });
        break;
      case "lichessRapid":
        orderBy.push({ lichessRapid: "desc" });
        break;
      default:
        orderBy.push({ name: "asc" });
    }

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          federation: true,
          lichessUsername: true,
          lichessTitle: true,
          fideTitle: true,
          fideRating: true,
          lichessRapid: true,
          lichessBlitz: true,
          lichessClassical: true,
        },
      }),
      prisma.player.count({ where }),
    ]);

    const response: PaginatedResponse<PlayerListItem> = {
      data: players,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Players fetch error:", error);
    return NextResponse.json(
      { error: "فشل في جلب قائمة اللاعبين" },
      { status: 500 }
    );
  }
}
