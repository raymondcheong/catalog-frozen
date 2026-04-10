/**
 * 盲盒：查詢是否已參與、抽獎並記錄（每 campaign + userId 僅一次）
 */
import { getStore } from "@netlify/blobs";
import { CAMPAIGNS } from "./blindbox-config.mjs";

const STORE_NAME = "blindbox-participations";
const KEY = "records";

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function pickPrize(prizes) {
  const list = Array.isArray(prizes) ? prizes : [];
  if (list.length === 0) return null;
  const total = list.reduce((s, p) => s + (Number(p.weight) > 0 ? Number(p.weight) : 1), 0);
  let r = Math.random() * total;
  for (const p of list) {
    const w = Number(p.weight) > 0 ? Number(p.weight) : 1;
    r -= w;
    if (r <= 0) return p.code || null;
  }
  return list[list.length - 1].code || null;
}

function campaignWindowOk(c) {
  const now = Date.now();
  const start = c.start ? new Date(c.start).getTime() : 0;
  const end = c.end ? new Date(c.end).getTime() : Infinity;
  return now >= start && now <= end;
}

function makeRecordKey(campaignId, userId) {
  return `${String(campaignId).trim()}|${String(userId).trim()}`;
}

async function readRecords(store) {
  try {
    const raw = await store.get(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

function sanitizeUserId(userId) {
  const s = String(userId ?? "").trim();
  if (s.length < 2 || s.length > 256) return null;
  return s;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);

  let campaignId = "";
  let userId = "";

  if (req.method === "GET") {
    campaignId = url.searchParams.get("campaignId") || "";
    userId = url.searchParams.get("userId") || "";
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      campaignId = body.campaignId || "";
      userId = body.userId || "";
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  const uid = sanitizeUserId(userId);
  if (!uid) {
    return new Response(
      JSON.stringify({ error: "缺少或無效的 userId（須由 APP 傳入裝置／用戶識別）" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const cid = String(campaignId || "").trim();
  if (!cid) {
    return new Response(JSON.stringify({ error: "缺少 campaignId" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const campaign = CAMPAIGNS[cid];
  if (!campaign) {
    return new Response(JSON.stringify({ error: "未知的活動 campaignId" }), {
      status: 404,
      headers: corsHeaders(),
    });
  }

  if (!campaignWindowOk(campaign)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "not_in_window",
        message: "活動未開始或已結束",
        label: campaign.label || cid,
      }),
      { status: 200, headers: corsHeaders() }
    );
  }

  const store = getStore(STORE_NAME);
  const records = await readRecords(store);
  const rkey = makeRecordKey(cid, uid);
  const existing = records[rkey];

  if (req.method === "GET") {
    if (existing) {
      return new Response(
        JSON.stringify({
          ok: true,
          participated: true,
          productCode: existing.productCode,
          participatedAt: existing.participatedAt,
          campaignLabel: campaign.label || cid,
        }),
        { status: 200, headers: corsHeaders() }
      );
    }
    return new Response(
      JSON.stringify({
        ok: true,
        participated: false,
        campaignLabel: campaign.label || cid,
      }),
      { status: 200, headers: corsHeaders() }
    );
  }

  // POST — 抽獎
  if (existing) {
    return new Response(
      JSON.stringify({
        ok: true,
        participated: true,
        already: true,
        productCode: existing.productCode,
        participatedAt: existing.participatedAt,
        campaignLabel: campaign.label || cid,
      }),
      { status: 200, headers: corsHeaders() }
    );
  }

  const code = pickPrize(campaign.prizes);
  if (!code) {
    return new Response(JSON.stringify({ error: "獎池為空，請檢查 blindbox-config.mjs" }), {
      status: 500,
      headers: corsHeaders(),
    });
  }

  const participatedAt = new Date().toISOString();
  records[rkey] = { productCode: code, participatedAt, campaignId: cid };
  await store.set(KEY, JSON.stringify(records));

  return new Response(
    JSON.stringify({
      ok: true,
      participated: true,
      already: false,
      productCode: code,
      participatedAt,
      campaignLabel: campaign.label || cid,
    }),
    { status: 200, headers: corsHeaders() }
  );
}
