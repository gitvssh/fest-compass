import { respond } from "@/lib/existing/http";
import { parseSchedule } from "@/lib/existing/request";
import { loadSchedule } from "@/lib/existing/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseSchedule, loadSchedule); }
