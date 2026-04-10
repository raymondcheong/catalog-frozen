/**
 * Netlify Function: Clear analytics data
 * POST with body: { secret: "xxx" }
 * Secret: 與 Netlify 環境變數 ANALYTICS_CLEAR_SECRET 一致，未設定時預設為 "clear"
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "analytics-events";
const KEY = "events";
const DEFAULT_SECRET = "clear";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const secret = process.env.ANALYTICS_CLEAR_SECRET || DEFAULT_SECRET;
    if (body.secret !== secret) {
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const store = getStore(STORE_NAME);
    await store.set(KEY, JSON.stringify([]));

    return new Response(JSON.stringify({ ok: true, message: "Data cleared" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("analytics-clear:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
};
