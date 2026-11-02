export async function onRequest(context) {
  const { request, env } = context;
  const clientUrl = new URL(request.url);

  // Mengutamakan Cloudflare ENV, jika tiada ia menggunakan sandaran pelayan (Edge Server sahaja)
  const supabaseUrl =
    (env && env.SUPABASE_URL) || "https://app.tech4ag.my";
  const supabaseAnonKey =
    (env && env.SUPABASE_ANON_KEY) ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY";

  // 1. Laluan Semakan Diagnostik
  if (clientUrl.pathname === "/api/debug") {
    return new Response(
      JSON.stringify(
        {
          status: "Cloudflare Pages Function Berjaya Beroperasi",
          keys_ditemui_dalam_env: Object.keys(env || {}),
          has_SUPABASE_URL_env: Boolean(env && env.SUPABASE_URL),
          has_SUPABASE_ANON_KEY_env: Boolean(env && env.SUPABASE_ANON_KEY),
          active_backend_url: supabaseUrl,
          active_backend_key_ready: Boolean(supabaseAnonKey)
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }

  const subPath = clientUrl.pathname.replace(/^\/api/, "");
  const targetUrl = new URL(
    `${supabaseUrl.replace(/\/+$/, "")}${subPath}${clientUrl.search}`
  );

  // Gantikan apikey penanda kepada token sebenar untuk permintaan URL
  if (
    targetUrl.searchParams.get("apikey") === "edge-proxy-managed" ||
    !targetUrl.searchParams.has("apikey")
  ) {
    targetUrl.searchParams.set("apikey", supabaseAnonKey);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("host");
  requestHeaders.delete("origin");
  requestHeaders.delete("referer");

  requestHeaders.set("apikey", supabaseAnonKey);

  const existingAuth = requestHeaders.get("authorization");
  if (
    !existingAuth ||
    existingAuth.trim() === "" ||
    existingAuth.includes("null") ||
    existingAuth.includes("undefined") ||
    existingAuth.includes("edge-proxy-managed")
  ) {
    requestHeaders.set("authorization", `Bearer ${supabaseAnonKey}`);
  }

  // Pengendalian jabat tangan WebSocket (Supabase Realtime)
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    return fetch(targetUrl.toString(), {
      method: request.method,
      headers: requestHeaders
    });
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);

  let body = null;
  if (hasBody) {
    body = await request.arrayBuffer();
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: method,
      headers: requestHeaders,
      body: body,
      redirect: "follow"
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    const isNullBodyStatus =
      upstreamResponse.status === 204 || upstreamResponse.status === 304;
    const responseBody = isNullBodyStatus ? null : upstreamResponse.body;

    return new Response(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Bad Gateway",
        message: "Gagal berhubung dengan pelayan pangkalan data upstream.",
        details: error.message
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }
}
