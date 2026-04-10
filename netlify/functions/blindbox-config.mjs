/**
 * 盲盒活動與獎池設定（後端權威來源）
 * ─────────────────────────────────────
 * 修改活動時間、獎池內容請編輯本檔案並重新部署。
 *
 * prizes：每項需有 code（對應 products.js 的產品編號）、weight（權重，數字愈大機率愈高）
 * 同一 campaignId 內，每個 userId 僅能成功抽獎一次（由 blindbox.mjs 寫入 Netlify Blobs）
 */
export const CAMPAIGNS = {
  /** 預設活動 ID，blindbox.html 的 data-campaign 須與此一致 */
  spring2025: {
    label: "2025 春季盲盒（中國豬肉）",
    /** ISO 8601，活動開始（含） */
    start: "2025-03-01T00:00:00+08:00",
    /** ISO 8601，活動結束（含） */
    end: "2025-12-31T23:59:59+08:00",
    /** 與 products.js 內 code 一致；weight 相同＝各 50% 隨機 */
    prizes: [
      { code: "CN-PK-001", weight: 50 },
      { code: "CN-PK-002", weight: 50 },
    ],
  },
};
