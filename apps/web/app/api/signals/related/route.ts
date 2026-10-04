import { respond } from "@/lib/existing/http";
import { parseRelated } from "@/lib/kto-signals/request";
import { loadRelated } from "@/lib/kto-signals/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseRelated, loadRelated); }
