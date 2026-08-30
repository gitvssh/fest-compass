const HEALTH_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  Expires: "0",
  Pragma: "no-cache",
} as const;

export function livenessResponse(): Response {
  return jsonHealth(200, "alive");
}

export async function readinessResponse(probe: () => Promise<unknown>): Promise<Response> {
  try {
    await probe();
    return jsonHealth(200, "ready");
  } catch {
    return jsonHealth(503, "not_ready");
  }
}

function jsonHealth(status: number, state: string): Response {
  return new Response(JSON.stringify({ status: state }), {
    status,
    headers: HEALTH_HEADERS,
  });
}
