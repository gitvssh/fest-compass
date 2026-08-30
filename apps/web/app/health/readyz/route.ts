import { prisma } from "@/lib/db";
import { readinessResponse } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export function GET() {
  return readinessResponse(() => prisma.festival.findFirst({ select: { id: true } }));
}
