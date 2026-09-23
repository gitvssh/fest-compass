import "server-only";
import { InvalidRequest } from "./request";
import { NotFound } from "./server";

// GET-only JSON responses. Parameter problems name the field; upstream failures are carried per source inside 200 bodies.
export async function respond<Req, Res>(request: Request, parse: (p: URLSearchParams) => Req, load: (req: Req) => Promise<Res>): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  let req: Req;
  try { req = parse(new URL(request.url).searchParams); }
  catch (e) { return Response.json({ error: { code: "invalid-request", field: e instanceof InvalidRequest ? e.field : "query" } }, { status: 400, headers }); }
  try { return Response.json(await load(req), { headers }); }
  catch (e) {
    if (e instanceof InvalidRequest) return Response.json({ error: { code: "invalid-request", field: e.field } }, { status: 400, headers });
    if (e instanceof NotFound) return Response.json({ error: { code: "not-found", field: e.field } }, { status: 404, headers });
    return Response.json({ error: { code: "source-unavailable", retryable: true } }, { status: 503, headers });
  }
}
