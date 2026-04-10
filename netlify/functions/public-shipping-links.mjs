/**
 * 無付費 API 時：依櫃號／提單與船公司代碼產生公開查詢連結（track-trace、部分船公司官網）。
 * 連結仅供跳转第三方站点查询，本站不抓取其页面内容。
 */

/** SeaRates / SCAC 常见代码 → 中文（展示用） */
export const SEALINE_LABEL_ZH = {
  auto: "自動辨識（依單證格式）",
  MAEU: "馬士基 Maersk",
  MSCU: "地中海航運 MSC",
  CMDU: "達飛 CMA CGM",
  COSU: "中遠海 COSCO",
  EGLV: "長榮 Evergreen",
  HLCU: "赫伯羅特 Hapag-Lloyd",
  ONEY: "海洋網聯 ONE",
  OOLU: "東方海外 OOCL",
  YMLU: "陽明海运 Yang Ming",
  ZIMU: "以星 ZIM",
  PILU: "太平船務 PIL",
  SUDU: "中外运 SNL",
};

const enc = (s) => encodeURIComponent(String(s || "").trim());

/**
 * 船公司直达查询（URL 可能随官网改版失效；失效时 track-trace 仍可用）
 * @param {string} sealine uppercase SCAC or "AUTO"
 * @param {string} number 单证号码
 * @param {"CT"|"BK"|"BL"} seaType
 */
export function carrierDirectUrl(sealine, number, seaType) {
  const sl = String(sealine || "auto").toUpperCase();
  const n = String(number || "").trim();
  if (!n) return null;
  const t = String(seaType || "BL").toUpperCase();
  /**
   * 達飛：舊版 …/tracking/search?Reference=… 常只開「Track my Shipment」空表單、不帶入櫃號。
   * 官方直達單票頁為 …/ebusiness/tracking/detail/{櫃號或提單或訂艙號}（站內自動辨識類型）。
   */
  if ((sl === "CMDU" || sl === "CMA") && (t === "CT" || t === "BL" || t === "BK")) {
    return `https://www.cma-cgm.com/ebusiness/tracking/detail/${enc(n)}`;
  }
  if (t === "CT") {
    if (sl === "MAEU") {
      return `https://www.maersk.com/tracking/#tracking/tracking/search?reference=${enc(n)}&searchType=CONTAINER`;
    }
    if (sl === "COSU" || sl === "COSCO") {
      return `https://elines.coscoshipping.com/ebusiness/cargotracking?trackingType=CONTAINER&number=${enc(n)}`;
    }
    if (sl === "HLCU" || sl === "HAPAG") {
      return `https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?bl_number=&container_number=${enc(n)}&booking_number=&type=container`;
    }
    if (sl === "EGLV" || sl === "EVERGREEN") {
      return `https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do?TYPE=CNTR&CNTR_NO=${enc(n)}`;
    }
  }
  if (t === "BL") {
    if (sl === "MAEU") {
      return `https://www.maersk.com/tracking/#tracking/tracking/search?reference=${enc(n)}&searchType=BILL_OF_LADING`;
    }
    if (sl === "COSU" || sl === "COSCO") {
      return `https://elines.coscoshipping.com/ebusiness/cargotracking?trackingType=BILL&number=${enc(n)}`;
    }
    if (sl === "HLCU" || sl === "HAPAG") {
      return `https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?bl_number=${enc(n)}&container_number=&booking_number=&type=bl`;
    }
  }
  if (t === "BK") {
    if (sl === "MAEU") {
      return `https://www.maersk.com/tracking/#tracking/tracking/search?reference=${enc(n)}&searchType=BOOKING`;
    }
    if (sl === "COSU" || sl === "COSCO") {
      return `https://elines.coscoshipping.com/ebusiness/cargotracking?trackingType=BOOKING&number=${enc(n)}`;
    }
    if (sl === "HLCU" || sl === "HAPAG") {
      return `https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?bl_number=&container_number=&booking_number=${enc(n)}&type=booking`;
    }
  }
  return null;
}

function sealineIsSpecific(sl) {
  const u = String(sl || "").trim().toUpperCase();
  return u.length > 0 && u !== "AUTO";
}

/**
 * @param {"CT"|"BK"|"BL"} seaType
 * @param {string} number
 * @param {string} sealine
 * @returns {{ label: string, url: string }[]}
 */
export function buildPublicTrackingLinks(seaType, number, sealine) {
  const n = String(number || "").trim();
  const t = String(seaType || "BL").toUpperCase();
  if (!n) return [];

  const links = [];
  const sl = String(sealine || "auto").trim();
  const slU = sl.toUpperCase();
  const zh = SEALINE_LABEL_ZH[slU] || sl;
  const wantOfficialFirst = sealineIsSpecific(sl);

  if (t === "CT") {
    const direct = carrierDirectUrl(sl, n, "CT");
    if (wantOfficialFirst && direct) {
      const cmaNote =
        slU === "CMDU" || slU === "CMA"
          ? "（達飛為直達追蹤頁 /detail/櫃號，一般無需再填搜尋框）"
          : "（網址已帶櫃號；若仍空白請按「搜尋／Search」）";
      links.push({
        label: `${zh} · 【優先】官網貨櫃${cmaNote}`,
        url: direct,
      });
    }
    links.push({
      label: "Track-Trace 貨櫃（聚合；網址已含櫃號，開啟後一般再按 Track）",
      url: `https://www.track-trace.com/container?number=${enc(n)}`,
    });
    if (!wantOfficialFirst && direct) {
      links.push({
        label: `${zh} · 官網貨櫃（網址已帶櫃號）`,
        url: direct,
      });
    }
  } else if (t === "BL") {
    const direct = carrierDirectUrl(sl, n, "BL");
    if (wantOfficialFirst && direct) {
      const cmaBl =
        slU === "CMDU" || slU === "CMA"
          ? "（達飛為直達追蹤頁 /detail/提單號）"
          : "（網址已帶單號；必要時請按查詢鈕）";
      links.push({
        label: `${zh} · 【優先】官網提單${cmaBl}`,
        url: direct,
      });
    }
    links.push({
      label: "Track-Trace 提單（聚合；網址已含單號）",
      url: `https://www.track-trace.com/bol?number=${enc(n)}`,
    });
    if (!wantOfficialFirst && direct) {
      links.push({
        label: `${zh} · 官網提單（網址已帶單號）`,
        url: direct,
      });
    }
  } else {
    const direct = carrierDirectUrl(sl, n, "BK");
    if (direct) {
      const cmaBk =
        slU === "CMDU" || slU === "CMA"
          ? "（達飛為直達追蹤頁 /detail/訂艙號）"
          : "（網址已帶訂艙號；必要時請按查詢鈕）";
      links.push({
        label: `${zh} · 【優先】官網訂艙${cmaBk}`,
        url: direct,
      });
    }
    links.push({
      label: "Track-Trace 提單頁（訂艙格式接近 B/L 時可試；已帶單號）",
      url: `https://www.track-trace.com/bol?number=${enc(n)}`,
    });
    links.push({
      label: `Google 搜尋（訂艙補查）：${n}`,
      url: `https://www.google.com/search?q=${enc(`${n} ${sl !== "auto" ? sl : ""} booking container tracking`)}`,
    });
  }

  return links;
}

export function sealineDisplayZh(sealine, carrierDisplayName) {
  const name = String(carrierDisplayName || "").trim();
  if (name) return name;
  const sl = String(sealine || "auto").toUpperCase();
  return SEALINE_LABEL_ZH[sl] || (sl === "AUTO" ? SEALINE_LABEL_ZH.auto : sl);
}
