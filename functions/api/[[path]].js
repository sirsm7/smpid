export async function onRequest(context) {
  const { request, env } = context;
  const clientUrl = new URL(request.url);

  const supabaseUrl = env && typeof env.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const supabaseAnonKey = env && typeof env.SUPABASE_ANON_KEY === "string" ? env.SUPABASE_ANON_KEY.trim() : "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        message: "Required environment variables SUPABASE_URL or SUPABASE_ANON_KEY are missing or empty."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }

  let targetUrl;
  try {
    const subPath = clientUrl.pathname.replace(/^\/api/, "");
    targetUrl = new URL(`${supabaseUrl.replace(/\/+$/, "")}${subPath}${clientUrl.search}`);
  } catch {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        message: "Invalid SUPABASE_URL format configured in environment variables."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }

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

  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    return fetch(targetUrl.toString(), {
      method: request.method,
      headers: requestHeaders
    });
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : null;

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method,
      headers: requestHeaders,
      body,
      redirect: "follow"
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.set("Cache-Control", "no-store");

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
        details: error && error.message ? error.message : "Upstream connection error"
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}