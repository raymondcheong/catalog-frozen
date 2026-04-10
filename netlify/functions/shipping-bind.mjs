/**
 * 運營綁定：產品編號 ↔ 追蹤資訊（存 Netlify Blobs，不寫進前端）。
 *
 * 兩種方式：
 * 1) 單證綁定：櫃號(CT) / 訂艙(BK) / 提單(BL) + 船公司(SCAC)；無 API 時由 track 返回公開查詢連結。可選 ETA/港口文字、地圖座標、船名航次。
 * 2) 手動維護：船名 + 航次 + 狀態 + ETA + 目的港等（適合尚未有櫃號或僅有船公司通知的情況）。
 *
 * POST /api/shipping/bind
 * Body JSON:
 *   { secret, productCode, bindingMode: "sea"|"manual", ... }
 *
 * Sea 模式欄位：
 *   seaType: "CT"|"BK"|"BL"
 *   seaNumber: 櫃號 / 訂艙號 / 提單號
 *   sealine?: string（SCAC，可選 auto）
 *   carrierDisplayName?, etaNote?, originNote?, destinationNote?（可選）
 *   originLat/Lng?, destinationLat/Lng?, positionLat/Lng?（可選，地圖）
 *   vesselName?, voyage?（可選）
 *
 * 向後兼容：僅傳 blNumber 時視為 BL + 該號碼。
 *
 * Manual 模式欄位：
 *   vesselName, voyage?, status: sailing|berthed|arrived,
 *   etaDisplay, destination, origin?,
 *   destinationLat?, destinationLng?, positionLat?, positionLng?
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";

/** netlify dev 有時未把根目錄 .env 注入 Functions，在此補讀（與正式部署控制台設定相容） */
function hydrateShippingOpsSecretFromDotenv() {
  if (process.env.SHIPPING_OPS_SECRET) return;
  for (const base of [process.cwd(), join(process.cwd(), "..")]) {
    const p = join(base, ".env");
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i === -1) continue;
        const key = t.slice(0, i).trim();
        if (key !== "SHIPPING_OPS_SECRET") continue;
        let v = t.slice(i + 1).trim();
        if (
          (v.startsWith("\"") && v.endsWith("\"")) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        process.env.SHIPPING_OPS_SECRET = v;
        return;
      }
    } catch {
      /* ignore */
    }
  }
}
hydrateShippingOpsSecretFromDotenv();

const STORE_NAME = "shipping-bindings";
const BLOB_KEY = "by-product";

const corsJson = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
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

function maskId(s) {
  const t = String(s || "").trim();
  if (t.length <= 6) return "***";
  return `${t.slice(0, 3)}***${t.slice(-3)}`;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return corsJson({ ok: false, error: "method_not_allowed" }, 405);
  }

  const secret = process.env.SHIPPING_OPS_SECRET || "";
  if (!secret) {
    return corsJson({ ok: false, error: "server_not_configured", message: "缺少 SHIPPING_OPS_SECRET" }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (body.secret !== secret) {
    return corsJson({ ok: false, error: "unauthorized" }, 401);
  }

  const productCode = String(body.productCode || "").trim();
  if (!productCode) {
    return corsJson({ ok: false, error: "missing_product_code" }, 400);
  }

  const bindingMode = String(body.bindingMode || body.mode || "").toLowerCase();

  const store = getStore(STORE_NAME);
  const map = await loadMap(store);
  const now = new Date().toISOString();

  if (bindingMode === "manual") {
    const vesselName = String(body.vesselName || "").trim();
    const voyage = String(body.voyage || "").trim();
    const status = String(body.status || "sailing").toLowerCase();
    const etaDisplay = String(body.etaDisplay || "").trim();
    const destination = String(body.destination || "").trim();
    const origin = String(body.origin || "").trim();

    if (!vesselName || !destination || !etaDisplay) {
      return corsJson({ ok: false, error: "missing_fields", message: "手動模式需填：船名、目的港、預計到港(ETA)" }, 400);
    }

    const allowed = new Set(["sailing", "berthed", "arrived"]);
    const st = allowed.has(status) ? status : "sailing";

    const destLat = body.destinationLat != null && body.destinationLat !== "" ? Number(body.destinationLat) : null;
    const destLng = body.destinationLng != null && body.destinationLng !== "" ? Number(body.destinationLng) : null;
    const posLat = body.positionLat != null && body.positionLat !== "" ? Number(body.positionLat) : null;
    const posLng = body.positionLng != null && body.positionLng !== "" ? Number(body.positionLng) : null;

    const destinationPosition =
      destLat != null && destLng != null && Number.isFinite(destLat) && Number.isFinite(destLng)
        ? { lat: destLat, lng: destLng }
        : null;
    const position =
      posLat != null && posLng != null && Number.isFinite(posLat) && Number.isFinite(posLng)
        ? { lat: posLat, lng: posLng }
        : null;

    map[productCode] = {
      kind: "manual",
      vesselName,
      voyage: voyage || "",
      status: st,
      statusLabel: String(body.statusLabel || "").trim() || undefined,
      etaDisplay,
      destination,
      origin: origin || undefined,
      destinationPosition,
      position,
      dataNote: String(body.dataNote || "").trim() || undefined,
      updatedAt: now,
    };

    await store.set(BLOB_KEY, JSON.stringify(map));

    return corsJson({
      ok: true,
      productCode,
      bindingMode: "manual",
      summary: `${vesselName}${voyage ? ` / ${voyage}` : ""} → ${destination}`,
    });
  }

  // SeaRates：櫃號 / 訂艙 / 提單
  let seaType = String(body.seaType || body.trackType || "").toUpperCase();
  let seaNumber = String(body.seaNumber || body.trackNumber || "").trim();

  if (!seaNumber && body.blNumber) {
    seaNumber = String(body.blNumber).trim();
    seaType = "BL";
  }
  if (!seaType || !["CT", "BK", "BL"].includes(seaType)) {
    seaType = "BL";
  }

  if (!seaNumber) {
    return corsJson({ ok: false, error: "missing_fields", message: "自動模式需填寫追蹤單號（櫃號／訂艙／提單）" }, 400);
  }

  const sealine = body.sealine != null && String(body.sealine).trim() !== ""
    ? String(body.sealine).trim()
    : "auto";

  const vesselName = String(body.vesselName || "").trim();
  const voyage = String(body.voyage || "").trim();
  const carrierDisplayName = String(body.carrierDisplayName || "").trim();
  const etaNote = String(body.etaNote || "").trim();
  const originNote = String(body.originNote || "").trim();
  const destinationNote = String(body.destinationNote || "").trim();

  const oLat = body.originLat != null && body.originLat !== "" ? Number(body.originLat) : null;
  const oLng = body.originLng != null && body.originLng !== "" ? Number(body.originLng) : null;
  const dLat = body.destinationLat != null && body.destinationLat !== "" ? Number(body.destinationLat) : null;
  const dLng = body.destinationLng != null && body.destinationLng !== "" ? Number(body.destinationLng) : null;
  const pLat = body.positionLat != null && body.positionLat !== "" ? Number(body.positionLat) : null;
  const pLng = body.positionLng != null && body.positionLng !== "" ? Number(body.positionLng) : null;

  const originPosition =
    oLat != null && oLng != null && Number.isFinite(oLat) && Number.isFinite(oLng)
      ? { lat: oLat, lng: oLng }
      : null;
  const destinationPosition =
    dLat != null && dLng != null && Number.isFinite(dLat) && Number.isFinite(dLng)
      ? { lat: dLat, lng: dLng }
      : null;
  const position =
    pLat != null && pLng != null && Number.isFinite(pLat) && Number.isFinite(pLng)
      ? { lat: pLat, lng: pLng }
      : null;

  map[productCode] = {
    kind: "sea",
    seaType,
    seaNumber,
    sealine,
    vesselName: vesselName || undefined,
    voyage: voyage || undefined,
    carrierDisplayName: carrierDisplayName || undefined,
    etaNote: etaNote || undefined,
    originNote: originNote || undefined,
    destinationNote: destinationNote || undefined,
    originPosition,
    destinationPosition,
    position,
    updatedAt: now,
  };

  await store.set(BLOB_KEY, JSON.stringify(map));

  return corsJson({
    ok: true,
    productCode,
    bindingMode: "sea",
    seaType,
    seaNumber: maskId(seaNumber),
    sealine,
  });
};
