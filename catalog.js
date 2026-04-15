const CONFIG = {
  storeName: "凍肉水產",
  tagline: "冷凍肉品 · 水產批發 · 線上詢盤專用",
  contact: {
    whatsapp: "+852 9411 0350",
  },
};
const REMARK_TEXT = "請點擊WhatsApp詢盤，並填寫客戶名稱、要貨數量、交期，對應sales復盤做實";

const LOGISTICS_STATUS_DEFAULT_LABEL = {
  sailing: "航行中",
  berthed: "靠泊中",
  arrived: "已到港",
};

const DEFAULT_LOGISTICS_DIFF =
  "與一般船期網站不同：下列資訊已與本產品批次綁定，您無需輸入櫃號、提單號或船名航次即可查看。";

let logisticsMap = null;

const TAG_LABELS = {
  NEW: "新品",
  HOT: "熱門",
  RESTOCK: "補貨",
  BESTSELLER: "熱銷",
  PREORDER: "預購",
  BASIC: "基本款",
};

const state = {
  category: "all",
  query: "",
  tags: new Set(),
  showOos: false,
  sort: "newest",
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

/** 船公司等第三方站無法改語系；以 Google 翻譯開啟約為繁體中文（少數站點可能阻擋或版面異常）。 */
function logisticsGoogleTranslateZhTwUrl(targetUrl) {
  const raw = String(targetUrl || "").trim();
  if (!raw || /^https?:\/\/translate\.google\./i.test(raw)) return "";
  try {
    const u = new URL(raw);
    if (u.hostname === "translate.google.com" || u.hostname === "translate.googleusercontent.com") {
      return "";
    }
  } catch {
    return "";
  }
  return `https://translate.google.com/translate?sl=auto&tl=zh-TW&hl=zh-TW&u=${encodeURIComponent(raw)}`;
}

function buildPlaceholderSvg({ title, subtitle, accent = "#ff4fd8" }) {
  const t = escapeHtml(title).slice(0, 28);
  const s = escapeHtml(subtitle).slice(0, 28);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${accent}" stop-opacity="0.35"/>
          <stop offset="0.55" stop-color="#6ee7ff" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#62ffb0" stop-opacity="0.10"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="#0b0b10"/>
      <rect x="40" y="40" width="1120" height="720" rx="40" fill="url(#g)" stroke="rgba(255,255,255,0.14)" />
      <circle cx="1020" cy="170" r="120" fill="rgba(255,255,255,0.07)"/>
      <circle cx="240" cy="610" r="160" fill="rgba(255,255,255,0.05)"/>
      <text x="90" y="190" fill="rgba(255,255,255,0.92)" font-size="56" font-family="ui-serif, Georgia, serif" font-weight="700">${t}</text>
      <text x="90" y="255" fill="rgba(255,255,255,0.70)" font-size="28" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial">${s}</text>
      <text x="90" y="710" fill="rgba(255,255,255,0.55)" font-size="22" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Image placeholder • Replace with your photos</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function productMatchesQuery(p, q) {
  if (!q) return true;
  const log = p.logistics;
  const hay = normalizeText([
    p.code,
    p.name,
    p.category,
    p.material,
    (p.tags || []).join(" "),
    (p.colors || []).map(c => c.name).join(" "),
    (p.sizes || []).join(" "),
    p.desc,
    p.note,
    log && [
      log.headline,
      log.etaDisplay,
      log.origin,
      log.destination,
      log.vesselSummary,
      log.statusLabel,
    ].filter(Boolean).join(" "),
  ].join(" "));
  return hay.includes(normalizeText(q));
}

function getPrimaryImage(p) {
  const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (imgs.length > 0) return imgs[0];
  const accent = (p.colors?.[0]?.hex) || "#ff4fd8";
  return buildPlaceholderSvg({ title: p.name || "Product", subtitle: p.code || "", accent });
}

function getImages(p) {
  const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (imgs.length > 0) return imgs;
  const accent = (p.colors?.[0]?.hex) || "#ff4fd8";
  return [
    buildPlaceholderSvg({ title: p.name || "Product", subtitle: p.code || "", accent }),
    buildPlaceholderSvg({ title: "Detail", subtitle: p.category || "", accent }),
    buildPlaceholderSvg({ title: "Material", subtitle: p.material || "", accent }),
  ];
}

function formatTags(tags) {
  const t = Array.isArray(tags) ? tags : [];
  return t.map(x => TAG_LABELS[x] ?? x);
}

function formatColors(colors) {
  const list = Array.isArray(colors) ? colors : [];
  if (list.length === 0) return "—";
  return list.map(c => c.name).join(" / ");
}

function formatSizes(sizes) {
  const list = Array.isArray(sizes) ? sizes : [];
  if (list.length === 0) return "—";
  return list.join(" / ");
}

function getPill(p) {
  if (p.available === false) return { text: "售罄", cls: "oos" };
  const tags = Array.isArray(p.tags) ? p.tags : [];
  if (tags.includes("NEW")) return { text: "新品", cls: "new" };
  if (tags.includes("HOT")) return { text: "熱門", cls: "hot" };
  return null;
}

function destroyLogisticsMap() {
  if (logisticsMap) {
    logisticsMap.remove();
    logisticsMap = null;
  }
}

function logisticsStatusPillClass(status) {
  if (status === "berthed") return "logistics-pill--berthed";
  if (status === "arrived") return "logistics-pill--arrived";
  if (status === "reference") return "logistics-pill--reference";
  return "logistics-pill--sailing";
}

function showLogisticsLoading(visible) {
  const el = $("#logisticsLoading");
  if (el) el.hidden = !visible;
}

function logisticsTrackOrigin() {
  const u = typeof window.SHIPPING_TRACK_API_URL === "string" ? window.SHIPPING_TRACK_API_URL.trim() : "";
  if (u) return u.replace(/\/$/, "");
  return location.origin.replace(/\/$/, "");
}

async function fetchLiveLogistics(productCode) {
  const origin = logisticsTrackOrigin();
  const url = `${origin}/api/shipping/track?code=${encodeURIComponent(productCode)}`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

function fillLogisticsFields(log) {
  const titleEl = $("#logisticsTitle");
  if (titleEl) titleEl.textContent = log.headline || "期貨物流 · 已綁定本產品批次";

  const diffEl = $("#logisticsDiff");
  if (diffEl) diffEl.textContent = log.diffNote || DEFAULT_LOGISTICS_DIFF;

  const etaEl = $("#logisticsEta");
  if (etaEl) etaEl.textContent = log.etaDisplay || "—";

  const destEl = $("#logisticsDest");
  if (destEl) destEl.textContent = log.destination || "—";

  const originEl = $("#logisticsOrigin");
  if (originEl) originEl.textContent = log.origin || "—";

  const vesselEl = $("#logisticsVessel");
  if (vesselEl) vesselEl.textContent = log.vesselSummary || "—";

  const updatedEl = $("#logisticsUpdated");
  if (updatedEl) updatedEl.textContent = log.lastUpdated || "—";

  const noteEl = $("#logisticsDataNote");
  if (noteEl) {
    noteEl.textContent = log.dataNote || "";
    noteEl.hidden = !log.dataNote;
  }

  const refEl = $("#logisticsRef");
  if (refEl) {
    refEl.textContent = log.referenceLine || "—";
  }

  const linksWrap = $("#logisticsLinks");
  if (linksWrap) {
    const list = Array.isArray(log.trackingLinks) ? log.trackingLinks : [];
    if (list.length) {
      linksWrap.hidden = false;
      linksWrap.innerHTML =
        '<span class="logistics-links-label">公開查詢（另開新分頁；外文官網可點同組「繁體中文」）</span>' +
        list
          .map((x) => {
            const tr = logisticsGoogleTranslateZhTwUrl(x.url);
            const row =
              `<a class="logistics-external-link" href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.label)}</a>` +
              (tr
                ? `<a class="logistics-translate-link" href="${escapeHtml(tr)}" target="_blank" rel="noopener noreferrer">繁體中文 · Google 翻譯開啟</a>`
                : "");
            return `<div class="logistics-link-row">${row}</div>`;
          })
          .join("");
    } else {
      linksWrap.hidden = true;
      linksWrap.innerHTML = "";
    }
  }

  const status = log.status || "sailing";
  const pill = $("#logisticsStatusPill");
  if (pill) {
    pill.textContent = log.statusLabel || LOGISTICS_STATUS_DEFAULT_LABEL[status] || status;
    pill.className = `logistics-status-pill ${logisticsStatusPillClass(status)}`;
  }
}

function applyLogisticsErrorState(message) {
  const pill = $("#logisticsStatusPill");
  if (pill) {
    pill.textContent = "無法載入";
    pill.className = "logistics-status-pill";
  }
  const etaEl = $("#logisticsEta");
  if (etaEl) etaEl.textContent = "—";
  const linksWrap = $("#logisticsLinks");
  if (linksWrap) {
    linksWrap.hidden = true;
    linksWrap.innerHTML = "";
  }
  const mapEl = $("#logisticsMap");
  if (mapEl) {
    mapEl.innerHTML = `<p class="logistics-map-fallback">${escapeHtml(message)}</p>`;
  }
}

async function setLogisticsPanel(p) {
  const wrap = $("#modalLogisticsWrap");
  if (!wrap) return;
  destroyLogisticsMap();
  const base = p && p.logistics;
  if (!base || base.enabled === false) {
    wrap.hidden = true;
    showLogisticsLoading(false);
    return;
  }

  wrap.hidden = false;

  if (base.live) {
    const mapEl = $("#logisticsMap");
    if (mapEl) mapEl.innerHTML = "";
    showLogisticsLoading(true);
    fillLogisticsFields({
      ...base,
      headline: "期貨物流 · 載入中…",
      etaDisplay: "…",
      origin: "…",
      destination: "…",
      vesselSummary: "…",
      lastUpdated: "…",
      status: "sailing",
      statusLabel: "讀取中",
      dataNote: base.dataNote || "",
    });

    try {
      const data = await fetchLiveLogistics(p.code);
      showLogisticsLoading(false);
      if (!data.ok) {
        if (data.error === "no_binding") {
          applyLogisticsErrorState(
            "此環境尚未有該產品的航運綁定資料（Netlify Blobs 依「網站」分開存放，不會從本機同步）。請用瀏覽器開「正式網址」的 /dashboard.html，在期貨航運綁定裡再按一次保存；並確認該站 Netlify 已設定 SHIPPING_OPS_SECRET。若仍無資料請聯絡業務。",
          );
        } else {
          applyLogisticsErrorState(data.message || "無法取得航運資料，請稍後再試。");
        }
        return;
      }

      const merged = { ...data.logistics };
      // live 時標題／說明以 API 為準（避免 products.js 寫「自動同步」卻實際為公開連結模式）
      if (!base.live) {
        if (base.headline) merged.headline = base.headline;
        if (base.diffNote) merged.diffNote = base.diffNote;
      }
      if (base.dataNote) merged.dataNote = `${merged.dataNote ? `${merged.dataNote} ` : ""}${base.dataNote}`;

      fillLogisticsFields(merged);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => initLogisticsMapLeaflet(merged));
      });
    } catch (err) {
      showLogisticsLoading(false);
      applyLogisticsErrorState(err.message || "網絡錯誤，無法連線至追蹤服務。");
    }
    return;
  }

  showLogisticsLoading(false);
  fillLogisticsFields(base);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => initLogisticsMapLeaflet(base));
  });
}

function initLogisticsMapLeaflet(log) {
  const el = $("#logisticsMap");
  if (!el) return;

  if (typeof L === "undefined") {
    el.innerHTML = `<p class="logistics-map-fallback">地圖未能載入，請檢查網絡連線後重新整理頁面。</p>`;
    return;
  }

  const pos = log.position;
  const dest = log.destinationPosition;
  const orig = log.originPosition;
  const hasRoute = Array.isArray(log.route) && log.route.length >= 2;
  const hasGeo =
    hasRoute ||
    (pos && typeof pos.lat === "number") ||
    (dest && typeof dest.lat === "number") ||
    (orig && typeof orig.lat === "number");

  if (!hasGeo) {
    const list = Array.isArray(log.trackingLinks) ? log.trackingLinks : [];
    const first = list[0];
    const hint =
      list.length > 0
        ? "未在後台填寫裝卸港或船舶座標時，此處無法繪製航跡（並非櫃號錯誤）。即時船位、港口與 ETA 請使用右側「公開查詢」連結；需要示意地圖時請在監控台為該產品填寫座標。"
        : "目前無可在地圖上標繪的座標資料。";
    let html = `<p class="logistics-map-fallback">${escapeHtml(hint)}</p>`;
    if (first) {
      const tr = logisticsGoogleTranslateZhTwUrl(first.url);
      html += `<p class="logistics-map-fallback logistics-map-fallback--cta"><a class="logistics-external-link logistics-external-link--inline" href="${escapeHtml(first.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(first.label)}</a>` +
        (tr
          ? ` <a class="logistics-translate-link logistics-translate-link--inline" href="${escapeHtml(tr)}" target="_blank" rel="noopener noreferrer">繁體中文</a>`
          : "") +
        `</p>`;
    }
    el.innerHTML = html;
    return;
  }

  el.innerHTML = "";
  const center = (pos && typeof pos.lat === "number") ? pos
    : (dest && typeof dest.lat === "number") ? dest
      : { lat: 22.35, lng: 114.12 };

  logisticsMap = L.map(el, { scrollWheelZoom: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(logisticsMap);

  const bounds = [];

  if (Array.isArray(log.route) && log.route.length >= 2) {
    const latlngs = log.route.map(([la, lo]) => L.latLng(la, lo));
    L.polyline(latlngs, { color: "#6ee7ff", weight: 3, opacity: 0.88 }).addTo(logisticsMap);
    for (const ll of latlngs) bounds.push(ll);
  }

  if (orig && typeof orig.lat === "number" && typeof orig.lng === "number") {
    L.circleMarker([orig.lat, orig.lng], {
      radius: 6,
      color: "#62ffb0",
      fillColor: "#62ffb0",
      fillOpacity: 0.35,
      weight: 2,
    }).addTo(logisticsMap).bindPopup("裝貨港（概略）");
    bounds.push(L.latLng(orig.lat, orig.lng));
  }

  if (dest && typeof dest.lat === "number" && typeof dest.lng === "number") {
    L.circleMarker([dest.lat, dest.lng], {
      radius: 8,
      color: "#ff4fd8",
      fillColor: "#ff4fd8",
      fillOpacity: 0.35,
      weight: 2,
    }).addTo(logisticsMap).bindPopup("目的港（概略）");
    bounds.push(L.latLng(dest.lat, dest.lng));
  }

  if (pos && typeof pos.lat === "number" && typeof pos.lng === "number") {
    const shipIcon = L.divIcon({
      className: "logistics-ship-marker",
      html: "<span class=\"logistics-ship-glyph\" aria-hidden=\"true\"></span>",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([pos.lat, pos.lng], { icon: shipIcon })
      .addTo(logisticsMap)
      .bindPopup("船舶目前概略位置（參考）");
    bounds.push(L.latLng(pos.lat, pos.lng));
  }

  if (bounds.length >= 2) {
    logisticsMap.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 7 });
  } else if (bounds.length === 1) {
    logisticsMap.setView(bounds[0], 6);
  } else {
    logisticsMap.setView([center.lat, center.lng], 5);
  }

  setTimeout(() => {
    if (logisticsMap) logisticsMap.invalidateSize();
  }, 220);
}

function computeActiveSummary() {
  const parts = [];
  if (state.category !== "all") parts.push(`分類：${state.category}`);
  if (state.query) parts.push(`搜尋：「${state.query}」`);
  if (state.tags.size > 0) parts.push(`標籤：${Array.from(state.tags).map(t => TAG_LABELS[t] ?? t).join("、")}`);
  if (state.showOos) parts.push("含售罄");
  return parts.join(" · ");
}

function getAllProducts() {
  const list = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  return list
    .filter(p => p && p.code && p.name)
    .map(p => ({
      images: [],
      tags: [],
      colors: [],
      sizes: [],
      popularity: 0,
      available: true,
      ...p,
    }));
}

function filterAndSort(products) {
  let list = products.slice();

  if (state.category !== "all") {
    list = list.filter(p => p.category === state.category);
  }

  if (!state.showOos) {
    list = list.filter(p => p.available !== false);
  }

  if (state.tags.size > 0) {
    list = list.filter(p => (p.tags || []).some(t => state.tags.has(t)));
  }

  if (state.query) {
    list = list.filter(p => productMatchesQuery(p, state.query));
  }

  const byCodeAsc = (a, b) => String(a.code).localeCompare(String(b.code), "zh-Hant");
  const byCodeDesc = (a, b) => String(b.code).localeCompare(String(a.code), "zh-Hant");
  const byPopular = (a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0);
  const byNewest = (a, b) => (Number(b.releaseTs) || 0) - (Number(a.releaseTs) || 0);

  if (state.sort === "popular") list.sort(byPopular);
  else if (state.sort === "codeAsc") list.sort(byCodeAsc);
  else if (state.sort === "codeDesc") list.sort(byCodeDesc);
  else list.sort(byNewest);

  return list;
}

function renderTagChips(products) {
  const container = $("#tagChips");
  if (!container) return;
  const allTags = new Map();
  for (const p of products) {
    for (const t of (p.tags || [])) {
      allTags.set(t, (allTags.get(t) || 0) + 1);
    }
  }
  const sorted = Array.from(allTags.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  container.innerHTML = sorted.map(tag => {
    const label = TAG_LABELS[tag] ?? tag;
    const active = state.tags.has(tag);
    return `<button type="button" class="chip" data-tag="${escapeHtml(tag)}" data-active="${active ? "true" : "false"}">${escapeHtml(label)}</button>`;
  }).join("");

  for (const btn of $all(".chip", container)) {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-tag");
      if (!tag) return;
      if (state.tags.has(tag)) state.tags.delete(tag);
      else state.tags.add(tag);
      syncUrl();
      rerender();
    });
  }
}

function productCardHtml(p) {
  const pill = getPill(p);
  const img = getPrimaryImage(p);
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const tags = formatTags(p.tags || []).slice(0, 3);

  return `
    <article class="card" tabindex="0" role="button" aria-label="查看 ${escapeHtml(p.name)} 詳情" data-code="${escapeHtml(p.code)}">
      <img class="card-img" src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy" />
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(p.name)}</h3>
        <div class="card-sub">
          <span class="code">${escapeHtml(p.code)}</span>
          <span class="card-sub-pills">
            ${pill ? `<span class="pill ${pill.cls}">${escapeHtml(pill.text)}</span>` : `<span class="pill">${escapeHtml(p.category || "")}</span>`}
            ${p.logistics ? `<span class="pill pill-logistics">在途</span>` : ""}
          </span>
        </div>
        ${colors.length > 0 ? `
          <div class="swatches" aria-label="顏色">
            ${colors.slice(0, 6).map(c => `<span class="swatch" title="${escapeHtml(c.name)}" style="background:${escapeHtml(c.hex || "#fff")};"></span>`).join("")}
          </div>
        ` : ``}
        ${tags.length > 0 ? `
          <div class="card-tags">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ``}
      </div>
    </article>
  `.trim();
}

function renderGrid(list) {
  const grid = $("#productGrid");
  const count = $("#productCount");
  const empty = $("#emptyState");
  const summary = $("#activeFilterSummary");

  if (count) count.textContent = `共 ${list.length} 件商品`;
  if (summary) summary.textContent = computeActiveSummary();

  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  grid.innerHTML = list.map(productCardHtml).join("");
}

function buildWhatsAppText(p) {
  const priceStr = p.priceLines && Array.isArray(p.priceLines)
    ? p.priceLines.join("\n")
    : (p.price || "");
  return `我想訂購以下產品：\n產品：${p.name || ""}\n價格：${priceStr}\n箱數：（請填寫）\n交貨期：（請填寫）`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }
}

function populateModalContent(p) {
  $("#modalName").textContent = p.name || "—";
  $("#modalSub").textContent = (p.desc || "").slice(0, 80) || (p.category ? `${p.category}` : "—");
  $("#modalNameKv").textContent = p.name || "—";
  $("#modalCategory").textContent = p.category || "—";
  const specEl = $("#modalSpec");
  if (specEl) {
    if (p.specLines && Array.isArray(p.specLines)) {
      specEl.innerHTML = p.specLines.map((line) => escapeHtml(line)).join("<br>");
    } else {
      specEl.textContent = p.spec || "—";
    }
  }
  const priceEl = $("#modalPrice");
  if (p.priceLines && Array.isArray(p.priceLines)) {
    priceEl.innerHTML = p.priceLines.map((line) => escapeHtml(line)).join("<br>");
  } else {
    priceEl.textContent = p.price || "—";
  }
  $("#modalLead").textContent = p.leadTime || "—";
  $("#modalFactory").textContent = p.factory || "—";
  $("#modalPackaging").textContent = p.packaging || "—";
  $("#modalDesc").textContent = p.desc || "";
  $("#modalNote").textContent = p.note || "";
  const remarkEl = $("#modalRemark");
  if (remarkEl) {
    remarkEl.innerHTML = `<div class="kv"><span class="k">備註</span><span class="v">${escapeHtml(REMARK_TEXT)}</span></div>`;
  }

  const badge = $("#modalBadge");
  const pill = getPill(p);
  if (badge) {
    if (pill) {
      badge.hidden = false;
      badge.textContent = pill.text;
    } else {
      badge.hidden = true;
      badge.textContent = "";
    }
  }

  const tagsWrap = $("#modalTags");
  const tags = formatTags(p.tags || []);
  tagsWrap.innerHTML = tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");

  const imgs = getImages(p);
  const main = $("#modalImage");
  const thumbs = $("#modalThumbs");
  let activeIdx = 0;
  const setImg = (idx) => {
    activeIdx = idx;
    main.src = imgs[idx];
    main.alt = p.name || "Product";
    for (const el of $all(".thumb", thumbs)) el.dataset.active = "false";
    const active = thumbs.querySelector(`.thumb[data-idx="${idx}"]`);
    if (active) active.dataset.active = "true";
  };

  thumbs.innerHTML = imgs.map((src, idx) => `
    <button type="button" class="thumb" data-idx="${idx}" data-active="${idx === 0 ? "true" : "false"}" aria-label="圖片 ${idx + 1}">
      <img src="${escapeHtml(src)}" alt="" loading="lazy" />
    </button>
  `).join("");
  for (const t of $all(".thumb", thumbs)) {
    t.addEventListener("click", () => setImg(Number(t.dataset.idx || 0)));
  }
  setImg(activeIdx);

  const wa = $("#openWhatsapp");
  if (wa) {
    wa.dataset.productCode = p.code;
    wa.onclick = () => { if (window.trackInquiry) window.trackInquiry(p.code, "whatsapp"); };
    const msg = buildWhatsAppText(p);
    const encoded = encodeURIComponent(msg);
    const waNumber = String(CONFIG.contact.whatsapp || "").replace(/[^\d]/g, "");
    if (waNumber) {
      wa.hidden = false;
      wa.href = `https://wa.me/${waNumber}?text=${encoded}`;
    } else {
      wa.hidden = true;
      wa.href = "#";
    }
  }
}

function openModal() {
  const modal = $("#productModal");
  if (!modal) return;
  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
}

function closeModal() {
  destroyLogisticsMap();
  showLogisticsLoading(false);
  const wrap = $("#modalLogisticsWrap");
  if (wrap) wrap.hidden = true;
  const modal = $("#productModal");
  if (!modal) return;
  if (typeof modal.close === "function") modal.close();
  else modal.removeAttribute("open");
}

async function openProduct(code) {
  const products = getAllProducts();
  const p = products.find(x => x.code === code);
  if (!p) return;
  populateModalContent(p);
  openModal();
  await setLogisticsPanel(p);
  const url = new URL(location.href);
  url.searchParams.set("code", code);
  history.replaceState({}, "", url.toString());
}

function syncUrl() {
  const url = new URL(location.href);
  if (state.category !== "all") url.searchParams.set("cat", state.category);
  else url.searchParams.delete("cat");
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.tags.size > 0) url.searchParams.set("tags", Array.from(state.tags).join(","));
  else url.searchParams.delete("tags");
  if (state.showOos) url.searchParams.set("oos", "1");
  else url.searchParams.delete("oos");
  if (state.sort !== "newest") url.searchParams.set("sort", state.sort);
  else url.searchParams.delete("sort");
  history.replaceState({}, "", url.toString());
}

function loadFromUrl() {
  const url = new URL(location.href);
  const cat = url.searchParams.get("cat");
  const q = url.searchParams.get("q");
  const tags = url.searchParams.get("tags");
  const oos = url.searchParams.get("oos");
  const sort = url.searchParams.get("sort");

  if (cat) state.category = cat;
  if (q) state.query = q;
  if (tags) {
    state.tags = new Set(tags.split(",").map(x => x.trim()).filter(Boolean));
  }
  if (oos === "1") state.showOos = true;
  if (sort) state.sort = sort;
}

function bindUi() {
  const search = $("#searchInput");
  const sort = $("#sortSelect");
  const toggleOos = $("#toggleShowOos");

  const applyCategoryActive = () => {
    for (const b of $all(".filter-btn", $("#categoryGroup"))) {
      b.classList.toggle("active", b.getAttribute("data-category") === state.category);
    }
  };

  $("#categoryGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    const cat = btn.getAttribute("data-category");
    if (!cat) return;
    state.category = cat;
    applyCategoryActive();
    syncUrl();
    rerender();
  });

  search.addEventListener("input", () => {
    state.query = search.value.trim();
    syncUrl();
    rerender();
  });

  sort.addEventListener("change", () => {
    state.sort = sort.value;
    syncUrl();
    rerender();
  });

  toggleOos.addEventListener("change", () => {
    state.showOos = toggleOos.checked;
    syncUrl();
    rerender();
  });

  $("#resetFilters").addEventListener("click", () => {
    state.category = "all";
    state.query = "";
    state.tags = new Set();
    state.showOos = false;
    state.sort = "newest";
    syncUrl();
    rerender();
  });

  $("#clearAndShowAll").addEventListener("click", () => {
    state.category = "all";
    state.query = "";
    state.tags = new Set();
    state.showOos = false;
    syncUrl();
    rerender();
  });

  // 產品卡片點擊：使用事件委派，確保點擊可打開詳情
  const grid = $("#productGrid");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const code = card.getAttribute("data-code");
      if (!code) return;
      e.preventDefault();
      if (window.trackProductClick) window.trackProductClick(code, card.querySelector(".card-title")?.textContent || "");
      openProduct(code);
    });
    grid.addEventListener("keydown", (e) => {
      const card = e.target.closest(".card");
      if (!card || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      const code = card.getAttribute("data-code");
      if (!code) return;
      if (window.trackProductClick) window.trackProductClick(code, card.querySelector(".card-title")?.textContent || "");
      openProduct(code);
    });
  }

  const copyBtn = $("#copyCatalogLink");
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    const ok = await copyText(location.href);
    const btn = $("#copyCatalogLink");
    btn.textContent = ok ? "已複製連結" : "複製失敗";
    setTimeout(() => (btn.textContent = "複製目錄連結"), 1600);
  });

  $("#closeModal").addEventListener("click", () => {
    closeModal();
    const url = new URL(location.href);
    url.searchParams.delete("code");
    history.replaceState({}, "", url.toString());
  });

  $("#productModal").addEventListener("click", (e) => {
    const dialog = $("#productModal");
    const body = $(".modal-body", dialog);
    if (!body.contains(e.target)) {
      closeModal();
      const url = new URL(location.href);
      url.searchParams.delete("code");
      history.replaceState({}, "", url.toString());
    }
  });

  // initial UI values
  loadFromUrl();
  applyCategoryActive();
  search.value = state.query;
  sort.value = state.sort;
  toggleOos.checked = state.showOos;
}

function applyConfig() {
  $("#storeName").textContent = CONFIG.storeName || "產品目錄";
  $("#storeTagline").textContent = CONFIG.tagline || "";
  $("#contactWhatsapp").textContent = CONFIG.contact.whatsapp || "—";
  $("#copyrightText").textContent = `© ${CONFIG.storeName || "凍肉水產"} · 產品目錄僅供詢盤客戶閱覽`;
}

function rerender() {
  const products = getAllProducts();
  renderTagChips(products);
  const list = filterAndSort(products);
  renderGrid(list);

  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  if (code) void openProduct(code);
}

function main() {
  applyConfig();
  bindUi();
  rerender();
}

document.addEventListener("DOMContentLoaded", main);

