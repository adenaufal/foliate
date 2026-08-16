// Proxy to the local compile service. The browser never hits port 8723.
//
// Route Handler, not a Server Action: Server Actions cap the body at 1 MB and
// the service accepts a 2 MB manuscript (MAX_MARKDOWN_BYTES). Route handlers
// have no body limit.
//
// 127.0.0.1, not localhost: the service binds 0.0.0.0 (IPv4 only) and
// "localhost" can resolve to ::1. Override with COMPILE_SERVICE_URL.
const BASE = process.env.COMPILE_SERVICE_URL ?? "http://127.0.0.1:8723";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let upstream: Response;
  try {
    upstream = await fetch(`${BASE}/compile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Buffered on the way up (2 MB ceiling), streamed on the way back.
      // Forwarding req.body instead would need undici's `duplex: "half"`,
      // which TypeScript's RequestInit does not know about.
      body: await req.text(),
      // The service's own COMPILE_TIMEOUT_MS is 45 s; give it room to answer.
      // Extra headroom for a cold compile host (Render free sleeps after idle
      // and cold-starts in ~50 s) so the first request after a sleep still
      // lands instead of aborting mid-spin-up.
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return Response.json(
      {
        error: true,
        stage: "network",
        message: "Layanan compile tidak merespons. Pastikan compile-service jalan di " + BASE + ".",
      },
      { status: 503 },
    );
  }

  // Pass status and body through untouched — the service's structured 422
  // ({error, stage, message, line, hint}) is exactly what the UI renders.
  const headers = new Headers();
  for (const h of ["content-type", "content-disposition", "x-foliate-template"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
