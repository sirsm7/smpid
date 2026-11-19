export async function onRequestGet(context) {
  const env = (context && context.env) || {};
  const supabaseUrl = typeof env.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const supabaseAnonKey = typeof env.SUPABASE_ANON_KEY === "string" ? env.SUPABASE_ANON_KEY.trim() : "";
  const rawSchema = typeof env.SUPABASE_SCHEMA === "string" ? env.SUPABASE_SCHEMA.trim() : "";
  const supabaseSchema = rawSchema && rawSchema.toLowerCase() !== "public" ? rawSchema : "nadim_data";
  const gasEndpointUrl = typeof env.GAS_ENDPOINT_URL === "string" ? env.GAS_ENDPOINT_URL.trim() : "";
  const gasUploadUrl = typeof env.GAS_UPLOAD_URL === "string" ? env.GAS_UPLOAD_URL.trim() : "";
  const gasEmailUrl = typeof env.GAS_EMAIL_URL === "string" ? env.GAS_EMAIL_URL.trim() : "";
  const gasLibatUrusUrl = typeof env.GAS_LIBAT_URUS_URL === "string" ? env.GAS_LIBAT_URUS_URL.trim() : "";

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache"
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        message: "Required environment variables SUPABASE_URL or SUPABASE_ANON_KEY are missing or empty."
      }),
      {
        status: 500,
        headers
      }
    );
  }

  const payload = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SCHEMA: supabaseSchema
  };

  if (gasEndpointUrl) {
    payload.GAS_ENDPOINT_URL = gasEndpointUrl;
  }

  if (gasUploadUrl) {
    payload.GAS_UPLOAD_URL = gasUploadUrl;
  }

  if (gasEmailUrl) {
    payload.GAS_EMAIL_URL = gasEmailUrl;
  }

  if (gasLibatUrusUrl) {
    payload.GAS_LIBAT_URUS_URL = gasLibatUrusUrl;
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers
  });
}