# Netlify 部署說明（純 Netlify 數據監控）

本專案已整合 **Netlify Functions** 與 **Netlify Blobs**，無需 Railway、Render 等外部後端，即可在 Netlify 上完成：

- 產品目錄靜態頁面
- 埋點事件接收與儲存
- 數據監控儀表板

## 架構

| 功能 | 說明 |
|------|------|
| 產品目錄 | `index.html`、`products.js`、`catalog.js` |
| 埋點 API | `POST /api/analytics/event` → Netlify Function |
| 彙總 API | `GET /api/analytics/summary` → Netlify Function |
| 清空數據 | `POST /api/analytics/clear` → Netlify Function |
| 數據儲存 | Netlify Blobs（`analytics-events` store） |
| 監控儀表板 | `dashboard.html` |
| 期貨綁定 API | `POST /api/shipping/bind`、`GET /api/shipping/track`（存 Netlify Blobs `shipping-bindings`） |

### 期貨航運（後台綁定 → 客戶點連結預填單號）

1. 環境變數：`SHIPPING_OPS_SECRET`（與監控台密碼一致）、`SHIPPING_PROVIDER`（無 SeaRates 建議 `public`）、若有付費追蹤則 `searates` + `SEARATES_API_KEY`。
2. 在 `products.js` 為商品加上 `logistics: { live: true }` 並部署。
3. 開啟 `/dashboard.html` → 期貨航運綁定 → 選產品 → **單證模式** → 必填：**追蹤類型**（櫃號 CT / 訂艙 BK / 提單 BL）、**追蹤單號**、**船公司 SCAC**（例：達飛選 CMDU 以生成官網直達）→ **保存綁定**。
4. 客戶在目錄詳情點「公開查詢」：Track-Trace 為 `?number=單號`；部分船公司官網連結亦在網址帶參考號。即時 ETA 以第三方網站為準；本頁手填 ETA／港口為快照，不會自動跟官網同步。

## 部署步驟

> **重要**：若使用 **ZIP 手動上傳**，Netlify 可能不會部署 Functions，導致瀏覽記錄無法寫入。**請使用 deploy.bat** 部署以確保安裝 Functions。

1. **將 `catalog-frozen` 推送到 GitHub**（若尚未連接）

2. **在 Netlify 建立站點**
   - 連接 GitHub 倉庫
   - **Base directory**：設為 `catalog-frozen`（若專案在子資料夾）
   - **Build command**：留空或 `npm install`（確保安裝 `@netlify/blobs`）
   - **Publish directory**：`.` 或留空

3. **部署後網址**
   - 產品目錄：`https://你的網址.netlify.app/`
   - 數據監控：`https://你的網址.netlify.app/dashboard.html`

## 本機測試（Netlify Dev）

```bash
cd catalog-frozen
npm install
npx netlify dev
```

會啟動本地伺服器（預設 `http://localhost:8888`），Functions 與 Blobs 會模擬運行。

## 注意事項

- **dashboard.html** 目前為公開頁面，建議在 Netlify 設定 **密碼保護** 或 **Basic Auth** 以保護數據
- 本機開發時，若未使用 `netlify dev`，埋點會嘗試連到 `http://localhost:4000`（需啟動 analytics-backend）
