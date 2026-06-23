import { NextResponse } from "next/server";
import { databaseHealthCheck } from "@/lib/database";

export async function GET() {
  const health = await databaseHealthCheck();
  
  return NextResponse.json(health, {
    status: health.status === "healthy" ? 200 : 503,
  });
}
