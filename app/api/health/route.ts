import { NextResponse } from "next/server";
import { performHealthCheck } from "@/lib/database";

export async function GET() {
  const health = await performHealthCheck();
  
  const statusCode = health.systemStatus === "ok" ? 200 : 
                     health.systemStatus === "degraded" ? 200 : 503;
  
  return NextResponse.json(health, { status: statusCode });
}
