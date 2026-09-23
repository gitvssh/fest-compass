import { respond } from "@/lib/existing/http";
import { parseResourceDetail } from "@/lib/new-festival/request";
import { loadDetail } from "@/lib/new-festival/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseResourceDetail, loadDetail); }
