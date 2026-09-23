import { respond } from "@/lib/existing/http";
import { parseNewVisits } from "@/lib/new-festival/request";
import { loadVisits } from "@/lib/new-festival/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseNewVisits, loadVisits); }
