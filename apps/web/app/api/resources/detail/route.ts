import { respond } from "@/lib/existing/http";
import { parseResourceDetail } from "@/lib/new-festival/request";
import { loadDetail } from "@/lib/new-festival/server";
export const dynamic = "force-dynamic";
// Shared resource description for both festival journeys; /api/new/resource-detail stays as a compatible alias.
export function GET(request: Request) { return respond(request, parseResourceDetail, loadDetail); }
