import { livenessResponse } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export function GET() {
  return livenessResponse();
}
