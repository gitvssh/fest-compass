import { respond } from "@/lib/existing/http";
import { parseHistory } from "@/lib/existing/request";
import { loadHistory } from "@/lib/existing/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseHistory, loadHistory); }
