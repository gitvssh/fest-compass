import { respond } from "@/lib/existing/http";
import { parseMonthly } from "@/lib/existing/request";
import { loadMonthly } from "@/lib/existing/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseMonthly, loadMonthly); }
