/**
 * 依產品編號讀取綁定：手動快照直接返回；Sea 模式則代呼叫 SeaRates（CT/BK/BL）。
 *
 * GET /api/shipping/track?code=CN-PK-001
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import {
  buildPublicTrackingLinks,
  sealineDisplayZh,
} from "./public-shipping-links.mjs";

/** 自本機專案根目錄讀取 .env（與 netlify.toml 同層），避免 functions-serve 子目錄 cwd 找不到檔案；每請求套用一次方便改 .env 後無需冷啟推測。 */
function findProjectRootEnvPath() {
  let dir = process.cwd();
  for (let i = 0; i < 14; i++) {
    const marker = join(dir, "netlify.toml");
    const envPath = join(dir, ".env");
    if (existsSync(marker) && existsSync(envPath)) {
      return envPath;
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseDotenvKeyValues(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith("\"") && v.endsWith("\"")) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[key] = v;
  }
  return out;
}

/** 以專案 .env 覆寫追蹤相關變數（僅當檔案內有非空值時），本機與雲端「無 .env」時不影響控制台環境變數。 */
function applyTrackEnvFromProjectDotenv() {
  const envPath = findProjectRootEnvPath();
  if (!envPath) return;
  try {
    const raw = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
    const parsed = parseDotenvKeyValues(raw);
    if (parsed.SHIPPING_PROVIDER) {
      process.env.SHIPPING_PROVIDER = parsed.SHIPPING_PROVIDER;
    }
    if (parsed.SEARATES_API_KEY) {
      process.env.SEARATES_API_KEY = parsed.SEARATES_API_KEY;
    }
  } catch {
    /* ignore */
  }
}

const STORE_NAME = "shipping-bindings";
const BLOB_KEY = "by-product";

const corsJson = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "private, max-age=60",
    },
  });

async function loadMap(store) {
  try {
    const raw = await store.get(BLOB_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function bindingIsPresent(b) {
  if (!b || typeof b !== "object") return false;
  if (b.kind === "manual") {
    return Boolean(String(b.vesselName || "").trim() && String(b.destination || "").trim() && String(b.etaDisplay || "").trim());
  }
  if (b.kind === "sea") {
    return Boolean(String(b.seaNumber || "").trim());
  }
  return Boolean(String(b.blNumber || "").trim());
}

function locById(locations, id) {
  if (!Array.isArray(locations) || id == null) return null;
  return locations.find((l) => l.id === id) || null;
}

function extractRoutePlan(routeField) {
  if (routeField && typeof routeField === "object" && !Array.isArray(routeField) && routeField.pol) {
    return routeField;
  }
  return null;
}

function extractRoutePolyline(routeField) {
  if (!Array.isArray(routeField)) return null;
  const pts = [];
  for (const seg of routeField) {
    if (seg && Array.isArray(seg.path)) {
      for (const p of seg.path) {
        if (Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          pts.push([p[0], p[1]]);
        }
      }
    }
  }
  return pts.length >= 2 ? pts : null;
}

function mapSealineStatus(metaStatus, pod) {
  const s = String(metaStatus || "").toUpperCase();
  if (pod && pod.actual === true) {
    return { status: "arrived", statusLabel: "已抵目的港（卸船前後）" };
  }
  if (s === "DELIVERED" || s === "COMPLETED" || s === "CLEARED") {
    return { status: "arrived", statusLabel: "已完成 / 已交付" };
  }
  if (s.includes("TERMINAL") || s === "AT_POD" || s === "DISCHARGED") {
    return { status: "berthed", statusLabel: "靠泊 · 港內作業" };
  }
  if (s === "IN_TRANSIT" || s === "ONBOARD" || s === "") {
    return { status: "sailing", statusLabel: "航行中" };
  }
  return { status: "sailing", statusLabel: metaStatus || "運輸中" };
}

const STATUS_LABEL_FALLBACK = {
  sailing: "航行中",
  berthed: "靠泊中",
  arrived: "已到港",
};

function normalizeManualBinding(b) {
  const status = b.status || "sailing";
  const statusLabel = b.statusLabel || STATUS_LABEL_FALLBACK[status] || status;
  const origin = b.origin ? String(b.origin) : "—";
  const destination = String(b.destination);
  const etaDisplay = String(b.etaDisplay);
  const originPosition = null;
  const destinationPosition = b.destinationPosition && b.destinationPosition.lat != null
    ? { lat: b.destinationPosition.lat, lng: b.destinationPosition.lng }
    : null;
  const position = b.position && b.position.lat != null
    ? { lat: b.position.lat, lng: b.position.lng }
    : null;

  let route = b.route;
  if (!route && destinationPosition && position) {
    route = [[position.lat, position.lng], [destinationPosition.lat, destinationPosition.lng]];
  } else if (!route && destinationPosition && origin !== "—" && b.originPosition) {
    route = [[b.originPosition.lat, b.originPosition.lng], [destinationPosition.lat, destinationPosition.lng]];
  }

  const vn = String(b.vesselName || "");
  const vy = String(b.voyage || "");
  const vesselSummary =
    `船名：${vn}${vy ? `；航次：${vy}` : ""}。` +
    "本筆由業務後台維護並綁定至本產品，客戶無需輸入櫃號或單證。";

  return {
    status,
    statusLabel,
    etaDisplay,
    origin,
    destination,
    originPosition,
    destinationPosition,
    position,
    route: route || null,
    vesselSummary,
    lastUpdated: String(b.updatedAt || new Date().toISOString()),
    dataNote:
      b.dataNote ||
      "本筆為後台維護之航次資訊（船名／航次／ETA 等），精確靠泊時間以船公司及港務書面通知為準。",
    headline: "期貨物流 · 與本產品綁定（後台維護）",
    diffNote:
      "與一般船期網站不同：您無需在頁面上輸入櫃號、提單或船名；我們已將本批期貨與航運資訊在後台關聯，打開產品即可查看。",
  };
}

function normalizeSearatesPayload(apiJson, binding) {
  if (!apiJson || apiJson.status !== "success" || !apiJson.data) {
    const msg = apiJson?.message || apiJson?.error || "追蹤 API 回傳異常";
    throw new Error(msg);
  }

  const data = apiJson.data;
  const meta = data.metadata || {};
  const locations = data.locations || [];
  const routeObj = extractRoutePlan(data.route);
  const routeLine = extractRoutePolyline(data.route);

  const pol = routeObj?.pol?.location != null ? locById(locations, routeObj.pol.location) : null;
  const podLoc = routeObj?.pod?.location != null ? locById(locations, routeObj.pod.location) : null;
  const pod = routeObj?.pod;

  const { status, statusLabel } = mapSealineStatus(meta.status, pod);

  let etaDisplay = "—";
  if (pod?.date) {
    etaDisplay = pod.actual
      ? `目的港抵達（實際）：${pod.date}`
      : `預計到港（ETA）：${pod.date}`;
  }

  const origin = pol
    ? `${pol.name}${pol.country ? `（${pol.country}）` : ""}`
    : "—";
  const destination = podLoc
    ? `${podLoc.name}${podLoc.country ? `（${podLoc.country}）` : ""}`
    : "—";

  const originPosition = pol && pol.lat != null && pol.lng != null
    ? { lat: pol.lat, lng: pol.lng }
    : null;
  const destinationPosition = podLoc && podLoc.lat != null && podLoc.lng != null
    ? { lat: podLoc.lat, lng: podLoc.lng }
    : null;

  const vessels = Array.isArray(data.vessels) ? data.vessels : [];
  const vesselNameApi = vessels[0]?.name || meta.sealine_name || "—";

  const extraVn = binding?.vesselName ? String(binding.vesselName).trim() : "";
  const extraVy = binding?.voyage ? String(binding.voyage).trim() : "";
  const carrierNote = binding?.carrierDisplayName
    ? `業務標註船東／船公司：${String(binding.carrierDisplayName).trim()}。`
    : "";
  const vesselSummary =
    carrierNote +
    `目前追蹤參考船舶：${vesselNameApi}` +
    (extraVn ? `（業務備註船名：${extraVn}${extraVy ? `，航次 ${extraVy}` : ""}）` : "") +
    `；船公司：${meta.sealine_name || meta.sealine || "—"}。` +
    "客戶無需自行輸入櫃號／訂艙／提單，資料已由本產品在後台綁定後自動查詢。";

  let position = null;
  const aisData = data.ais?.status === "OK" && data.ais?.data ? data.ais.data : null;
  const lastPos = aisData?.last_vessel_position;
  if (lastPos && lastPos.lat != null && lastPos.lng != null) {
    position = { lat: lastPos.lat, lng: lastPos.lng };
  }

  let route = routeLine;
  if (!route && originPosition && destinationPosition) {
    route = [
      [originPosition.lat, originPosition.lng],
      [destinationPosition.lat, destinationPosition.lng],
    ];
  }

  const lastUpdated =
    aisData?.updated_at ||
    meta.updated_at ||
    meta.cache_expires ||
    new Date().toISOString();

  const typeLabel = meta.type === "CT" ? "櫃號" : meta.type === "BK" ? "訂艙號" : "提單";
  const dataNote =
    `數據來源：SeaRates 追蹤（依後台綁定之${typeLabel}向船公司數據匯總）。` +
    `狀態碼：${meta.status || "—"}。` +
    (meta.from_cache ? " 本次可能為快取資料。" : "");

  return {
    status,
    statusLabel,
    etaDisplay,
    origin,
    destination,
    originPosition,
    destinationPosition,
    position,
    route,
    vesselSummary,
    lastUpdated: String(lastUpdated),
    dataNote,
    headline: "期貨物流 · 與本產品綁定（即時查詢）",
    diffNote:
      "與一般船期網站不同：您無需輸入櫃號、訂艙號、提單或船名航次；業務已在後台將追蹤單號或航次資訊綁定至本產品，頁面自動展示。",
  };
}

async function fetchSearates(number, sealine, type) {
  const key = process.env.SEARATES_API_KEY;
  if (!key) {
    throw new Error("未設定 SEARATES_API_KEY");
  }
  const params = new URLSearchParams({
    api_key: key,
    number,
    type: type || "BL",
    sealine: sealine || "auto",
    route: "true",
    ais: "true",
    force_update: "false",
  });
  const url = `https://tracking.searates.com/tracking?${params}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`追蹤服務回傳非 JSON（HTTP ${res.status}）`);
  }
  if (!res.ok) {
    throw new Error(json?.message || `追蹤服務 HTTP ${res.status}`);
  }
  return json;
}

/** 無 SeaRates（或僅作備援）：以真實綁定單證 + 公開查詢連結「互聯」，不使用假航跡。 */
function publicLinkLogistics(binding, opts = {}) {
  const seaType = String(binding.seaType || "BL").toUpperCase();
  const number = String(binding.seaNumber || "").trim();
  const sealine = String(binding.sealine || "auto").trim();
  const carrierZh = sealineDisplayZh(sealine, binding.carrierDisplayName);
  const typeLabel = seaType === "CT" ? "櫃號" : seaType === "BK" ? "訂艙號" : "提單號";

  const links = buildPublicTrackingLinks(seaType, number, sealine);

  const etaDisplay =
    binding.etaNote ||
    "即時 ETA／航程狀態未在本頁自動抓取（無付費船期 API）。請先點側欄頂部「公開查詢」連結，在 track-trace 或船公司官網查看。";
  const originFallback =
    "未在後台填寫裝貨港。請點「Track-Trace」或船公司連結查詢起運港／沿路狀態；或在監控台補填「裝貨港／地點」。";
  const destinationFallback =
    "未在後台填寫目的港。請點公開查詢連結查看卸貨港與 ETA；或在監控台補填「目的港／地點」。";
  const origin =
    binding.originNote ||
    (binding.originPosition ? "（裝貨地座標見地圖，由業務填寫）" : originFallback);
  const destination =
    binding.destinationNote ||
    (binding.destinationPosition ? "（卸貨地座標見地圖，由業務填寫）" : destinationFallback);

  const extraVn = binding.vesselName ? String(binding.vesselName).trim() : "";
  const extraVy = binding.voyage ? String(binding.voyage).trim() : "";

  const vesselSummary =
    `業務已將本產品與${typeLabel}、船公司資料綁定：「${number}」；船公司參考：${carrierZh}。` +
    (extraVn ? ` 補充船名：${extraVn}` : "") +
    (extraVy ? `；航次：${extraVy}` : "") +
    " 下方連結可至公開查詢站或官網核對，即時動態以該處為準。";

  const oP = binding.originPosition || null;
  const dP = binding.destinationPosition || null;
  const pos = binding.position || null;
  let route = null;
  if (oP && dP) {
    route = [[oP.lat, oP.lng], [dP.lat, dP.lng]];
  } else if (pos && dP) {
    route = [[pos.lat, pos.lng], [dP.lat, dP.lng]];
  } else if (oP && pos) {
    route = [[oP.lat, oP.lng], [pos.lat, pos.lng]];
  }

  const parts = [
    "本站未使用付費船期 API 時，不向船公司伺服器拉取軌跡資料；頁面展示您綁定的單證與公開查詢連結。",
    "選定船公司（非「自動」）時，公開查詢第一條為該船東官網直達（網址內已帶櫃號／單號）；是否一進頁就展開結果取決於官網程式，有時需再按「搜尋」。Track-Trace 為第二條備援（?number= 會預填單號）。",
    opts.note || "",
    opts.apiError ? `（SeaRates 失敗：${opts.apiError}）` : "",
  ];

  return {
    status: "reference",
    statusLabel: "已綁定 · 公開查詢",
    etaDisplay,
    origin,
    destination,
    originPosition: oP,
    destinationPosition: dP,
    position: pos,
    route,
    vesselSummary,
    lastUpdated: String(binding.updatedAt || new Date().toISOString()),
    dataNote: parts.filter(Boolean).join(" "),
    headline: "期貨物流 · 本批綁定單證與公開查詢",
    diffNote:
      "與一般船期網站不同：您無需在頁面輸入櫃號；我們已於後台綁定並提供第三方／官網查詢入口。靠泊與提貨時間以船公司與碼頭書面為準。",
    trackingLinks: links,
    referenceLine: `${typeLabel} ${number} · ${carrierZh}`,
  };
}

function mockLogistics(binding) {
  const label =
    binding?.kind === "sea"
      ? `${binding.seaType || "BL"} ${String(binding.seaNumber || "").slice(0, 4)}***`
      : "演示";
  return {
    status: "sailing",
    statusLabel: "演示 · 航行中（mock）",
    etaDisplay: "預計到港（演示）：配置 SEARATES_API_KEY 後可取得真實 ETA",
    origin: "演示 · 中國裝貨港（mock）",
    destination: "演示 · 香港目的港（mock）",
    originPosition: { lat: 30.62, lng: 122.07 },
    destinationPosition: { lat: 22.35, lng: 114.12 },
    position: { lat: 25.2, lng: 118.6 },
    route: [
      [30.62, 122.07],
      [28.0, 120.5],
      [25.2, 118.6],
      [22.35, 114.12],
    ],
    vesselSummary: `演示數據（${label}）。正式環境請設 SHIPPING_PROVIDER=searates。`,
    lastUpdated: new Date().toISOString(),
    dataNote: "目前為 MOCK 模式；自動綁定需 SeaRates，手動綁定不需 API。",
    headline: "期貨物流 · 與本產品綁定（演示）",
    diffNote:
      "與一般船期網站不同：客戶無需輸入任何追蹤號；運營在後台綁定櫃號／船名航次等資訊後，在此集中展示。",
  };
}

function resolveSeaBinding(binding) {
  if (binding.kind === "sea" && binding.seaNumber) {
    return {
      number: String(binding.seaNumber).trim(),
      type: String(binding.seaType || "BL").toUpperCase(),
      sealine: binding.sealine || "auto",
    };
  }
  if (binding.blNumber) {
    return {
      number: String(binding.blNumber).trim(),
      type: "BL",
      sealine: binding.sealine || "auto",
    };
  }
  return null;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "GET") {
    return corsJson({ ok: false, error: "method_not_allowed" }, 405);
  }

  applyTrackEnvFromProjectDotenv();

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  if (!code) {
    return corsJson({ ok: false, error: "missing_code" }, 400);
  }

  const store = getStore(STORE_NAME);
  const map = await loadMap(store);
  const binding = map[code];

  if (!bindingIsPresent(binding)) {
    return corsJson({ ok: false, error: "no_binding" }, 200);
  }

  if (binding.kind === "manual") {
    const logistics = normalizeManualBinding(binding);
    return corsJson({
      ok: true,
      productCode: code,
      provider: "manual",
      logistics,
    });
  }

  const sea = resolveSeaBinding(binding);
  if (!sea) {
    return corsJson({ ok: false, error: "no_binding" }, 200);
  }

  const providerEnv = (process.env.SHIPPING_PROVIDER || "public").toLowerCase();
  const hasSearatesKey = String(process.env.SEARATES_API_KEY || "").trim().length > 0;

  try {
    let logistics;
    let providerOut;

    if (providerEnv === "mock") {
      logistics = mockLogistics(binding);
      providerOut = "mock";
    } else if (providerEnv === "searates" && hasSearatesKey) {
      try {
        const raw = await fetchSearates(sea.number, sea.sealine, sea.type);
        logistics = normalizeSearatesPayload(raw, binding);
        providerOut = "searates";
      } catch (apiErr) {
        console.error("shipping-track searates:", apiErr);
        logistics = publicLinkLogistics(binding, {
          apiError: apiErr.message || "上游錯誤",
        });
        providerOut = "public";
      }
    } else {
      const note =
        providerEnv === "searates" && !hasSearatesKey
          ? "已設 SHIPPING_PROVIDER=searates 但未設定有效 SEARATES_API_KEY，改以公開連結整合。"
          : "";
      logistics = publicLinkLogistics(binding, { note });
      providerOut = "public";
    }

    return corsJson({
      ok: true,
      productCode: code,
      provider: providerOut,
      logistics,
    });
  } catch (err) {
    console.error("shipping-track:", err);
    return corsJson({
      ok: false,
      error: "upstream",
      message: err.message || "追蹤失敗",
      productCode: code,
    }, 200);
  }
};
