export async function onRequest(context) {
  const { request, env } = context;
  const clientUrl = new URL(request.url);

  // 1. Laluan Diagnostik: Buka https://<domain>/api/debug untuk semakan
  if (clientUrl.pathname === "/api/debug") {
    const rawKey = env.SUPABASE_ANON_KEY || "";
    const jwtParts = rawKey.split(".").length;
    return new Response(
      JSON.stringify(
        {
          status: "Cloudflare Pages Function Berjaya Beroperasi",
          has_SUPABASE_URL: Boolean(env.SUPABASE_URL),
          has_SUPABASE_ANON_KEY: Boolean(env.SUPABASE_ANON_KEY),
          anon_key_jwt_parts: jwtParts,
          anon_key_valid_format: jwtParts === 3,
          sampel_url: env.SUPABASE_URL ? `${env.SUPABASE_URL.slice(0, 16)}...` : null
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

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY ? env.SUPABASE_ANON_KEY.trim().replace(/^["']|["']$/g, "") : null;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        message: "SUPABASE_URL atau SUPABASE_ANON_KEY tidak ditemui pada persekitaran Cloudflare Pages ini.",
        keys_dikesan: Object.keys(env || {})
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }

  const subPath = clientUrl.pathname.replace(/^\/api/, "");
  const targetUrl = new URL(
    `${supabaseUrl.replace(/\/+$/, "")}${subPath}${clientUrl.search}`
  );

  // Gantikan parameter apikey jika tiada atau menggunakan penanda proksi
  const currentApiKeyParam = targetUrl.searchParams.get("apikey");
  if (!currentApiKeyParam || currentApiKeyParam === "edge-proxy-managed" || !currentApiKeyParam.includes(".")) {
    targetUrl.searchParams.set("apikey", supabaseAnonKey);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("host");
  requestHeaders.delete("origin");
  requestHeaders.delete("referer");

  // Paksa apikey upstream sentiasa menggunakan kunci sebenar
  requestHeaders.set("apikey", supabaseAnonKey);

  // Semak Authorization header: jika tiada, tidak lengkap, mengandungi 'edge-proxy-managed', atau bukan JWT 3 bahagian
  const existingAuth = requestHeaders.get("authorization");
  const authPayload = existingAuth ? existingAuth.replace(/^Bearer\s+/i, "").trim() : "";
  const isAuthInvalid = 
    !existingAuth || 
    existingAuth.trim() === "" || 
    existingAuth.includes("null") || 
    existingAuth.includes("undefined") || 
    existingAuth.includes("edge-proxy-managed") ||
    authPayload.split(".").length !== 3;

  if (isAuthInvalid) {
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

    const isNullBodyStatus = upstreamResponse.status === 204 || upstreamResponse.status === 304;
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
