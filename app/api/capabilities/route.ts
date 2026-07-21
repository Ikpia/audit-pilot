import { NextResponse } from "next/server";
import { getAuditPilotCapabilities } from "@/lib/config/capabilities";

export function GET() {
  return NextResponse.json(getAuditPilotCapabilities());
}
