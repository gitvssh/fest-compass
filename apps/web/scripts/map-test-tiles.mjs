// Automated pan/zoom must never request the community tile service. These are
// explicitly labelled synthetic tiles, not evidence of real road-map content.
export async function mockMapTiles(context, { fail = false, requests = [] } = {}) {
  await context.route("https://tile.openstreetmap.org/**", route => {
    requests.push({ url: route.request().url(), method: route.request().method(), headers: route.request().headers() });
    if (fail) return route.abort("failed");
    return route.fulfill({ status: fail ? 503 : 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eeea"/><path d="M0 128H256M128 0V256" stroke="#becbc7"/><text x="20" y="24" fill="#67776e" font-size="12">TEST TILE · 가상 배경</text></svg>' });
  });
}
