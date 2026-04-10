/**
 * Netlify Function: Get analytics summary for dashboard
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "analytics-events";
const KEY = "events";

function readEvents(store) {
  return store.get(KEY).then((raw) => {
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    const store = getStore(STORE_NAME);
    let events = await readEvents(store);

    if (from || to) {
      events = events.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        if (from && t < new Date(from).getTime()) return false;
        if (to && t > new Date(to).getTime()) return false;
        return true;
      });
    }

    const pageViews = events.filter((e) => e.type === "page_view");
    const pageLeaves = events.filter((e) => e.type === "page_leave");
    const productClicks = events.filter((e) => e.type === "product_click");
    const inquiryClicks = events.filter((e) => e.type === "inquiry_click");

    const productClickCount = {};
    productClicks.forEach((e) => {
      const code = e.payload?.productCode || "unknown";
      productClickCount[code] = (productClickCount[code] || 0) + 1;
    });

    const inquiryByProduct = {};
    inquiryClicks.forEach((e) => {
      const code = e.payload?.productCode || "unknown";
      if (!inquiryByProduct[code])
        inquiryByProduct[code] = { copy: 0, whatsapp: 0, email: 0 };
      const t = e.payload?.type || "copy";
      inquiryByProduct[code][t] = (inquiryByProduct[code][t] || 0) + 1;
    });

    const avgDuration =
      pageLeaves.length > 0
        ? Math.round(
            pageLeaves.reduce(
              (sum, e) => sum + (e.payload?.durationSec || 0),
              0
            ) / pageLeaves.length
          )
        : 0;

    const data = {
      totalPageViews: pageViews.length,
      totalSessions: new Set(
        pageViews.map((e) => e.sessionId || e.timestamp)
      ).size,
      avgDurationSec: avgDuration,
      totalProductClicks: productClicks.length,
      productClickCount,
      totalInquiries: inquiryClicks.length,
      inquiryByProduct,
      pageViewTimestamps: pageViews.map((e) => e.timestamp).sort((a, b) => new Date(b) - new Date(a)).slice(0, 50),
      productClickTimestamps: productClicks.map((e) => ({
        code: e.payload?.productCode,
        ts: e.timestamp,
      })),
      inquiryTimestamps: inquiryClicks.map((e) => ({
        code: e.payload?.productCode,
        type: e.payload?.type,
        ts: e.timestamp,
      })),
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("analytics-summary:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
