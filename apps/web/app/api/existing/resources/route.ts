import { respond } from "@/lib/existing/http";
import { parseResources } from "@/lib/existing/request";
import { loadResources } from "@/lib/existing/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, parseResources, loadResources); }
