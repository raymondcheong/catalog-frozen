/**
 * Netlify Function: Receive analytics events, store in Netlify Blob
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "analytics-events";
const KEY = "events";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: body.type || "unknown",
      payload: body.payload || {},
      timestamp: body.timestamp || new Date().toISOString(),
      page: body.page || "",
      sessionId: body.sessionId || "",
    };

    const store = getStore(STORE_NAME);
    let events = [];
    try {
      const raw = await store.get(KEY);
      if (raw) events = JSON.parse(raw);
    } catch {
      events = [];
    }
    events.push(event);
    await store.set(KEY, JSON.stringify(events));

    return new Response(JSON.stringify({ ok: true, id: event.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("analytics-event:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
