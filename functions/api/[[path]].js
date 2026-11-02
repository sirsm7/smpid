export async function onRequest(context) {
  const { request, env } = context;
  const clientUrl = new URL(request.url);

  // 1. Ambil dari Cloudflare ENV, jika tiada gunakan sandaran selamat pelayan pinggir
  const supabaseUrl =
    (env && env.SUPABASE_URL) || "https://app.tech4ag.my";
  const supabaseAnonKey =
    (env && env.SUPABASE_ANON_KEY) ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY";

  // Laluan Diagnostik: https://domain-anda.my/api/debug
  if (clientUrl.pathname === "/api/debug") {
    return new Response(
      JSON.stringify(
        {
          status: "Cloudflare Pages Function Berjaya Beroperasi",
          keys_ditemui_dalam_env: Object.keys(env || {}),
          has_SUPABASE_URL: Boolean(supabaseUrl),
          has_SUPABASE_ANON_KEY: Boolean(supabaseAnonKey),
          anon_key_jwt_parts: supabaseAnonKey ? supabaseAnonKey.split(".").length : 0,
          anon_key_valid_format: supabaseAnonKey ? supabaseAnonKey.split(".").length === 3 : false,
          sampel_url: supabaseUrl ? `${supabaseUrl.slice(0, 16)}...` : null
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

  // Gantikan apikey penanda kepada token sebenar dalam parameter URL
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

  // PEMBETULAN KRITIKAL PGRST301:
  // Semak sama ada token ialah JWT 3-bahagian yang sah. Jika ia 'edge-proxy-managed'
  // atau bukan format JWT (3 bahagian), gantikan dengan supabaseAnonKey sebenar.
  const existingAuth = requestHeaders.get("authorization");
  const rawToken = existingAuth ? existingAuth.replace(/^Bearer\s+/i, "").trim() : "";
  const isThreePartJwt = rawToken.split(".").length === 3;

  if (!existingAuth || !isThreePartJwt || rawToken === "edge-proxy-managed") {
    requestHeaders.set("authorization", `Bearer ${supabaseAnonKey}`);
  }

  // Pengendalian sambungan WebSocket (Supabase Realtime)
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
