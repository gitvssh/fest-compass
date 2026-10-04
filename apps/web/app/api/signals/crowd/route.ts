import { respond } from "@/lib/existing/http";
import { parseCrowd } from "@/lib/kto-signals/request";
import { loadCrowd } from "@/lib/kto-signals/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseCrowd, loadCrowd); }
