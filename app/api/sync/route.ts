import { NextResponse } from "next/server";
import { syncTournaments, syncPlayers, getSyncStatus } from "@/services/sync/orchestrator";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    if (source === "players") {
      const result = await syncPlayers();
      return NextResponse.json(result);
    } else if (source === "tournaments" || !source) {
      const result = await syncTournaments();
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Invalid source. Use 'tournaments' or 'players'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await getSyncStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
