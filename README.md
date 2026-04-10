## 女裝線上 Catalog（詢盤用）

打開 `catalog/index.html` 就能瀏覽全店款式（分類篩選、搜尋、產品詳情與一鍵複製詢盤文案）。

### 本機預覽

建議用簡單的靜態伺服器（避免瀏覽器對 `file://` 的限制）：

```bash
npm run start
```

或直接用 `serve`：

```bash
npx serve .
```

然後開啟 `http://localhost:3000/catalog/`

### 上架/更新商品

編輯 `catalog/products.js` 的 `window.PRODUCTS` 陣列即可。每個商品最少需要：

- `code`：款號（唯一）
- `name`：品名
- `category`：分類

你可以額外填入：

- `images`：圖片 URL 陣列（可填 1~多張）
- `colors`：顏色（可填色名與色碼，會顯示色點）
- `sizes`：尺碼
- `material` / `moq` / `leadTime` / `desc` / `note`
- `tags`：標籤（例：`NEW`、`HOT`、`BESTSELLER`、`RESTOCK`、`PREORDER`、`BASIC`）

### 修改店鋪資訊/聯絡方式

編輯 `catalog/catalog.js` 內的 `CONFIG`：

- `storeName`：店名
- `tagline`：副標
- `contact.wechat / contact.whatsapp / contact.email`：聯絡方式

