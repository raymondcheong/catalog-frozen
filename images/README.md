# 產品圖片資料夾

將產品圖片放在此資料夾，並在 `products.js` 中設定路徑。

## 使用方式

1. 將圖片檔（如 JPG、PNG）放入此資料夾
2. 在 `products.js` 的產品物件中加入 `images` 陣列：

```javascript
{
  code: "CN-PK-001",
  name: "高峰四肉/中國二肉",
  images: ["images/高峰四肉.jpg", "images/高峰四肉-細節.jpg"],  // 多張圖會顯示在詳情 modal
  // ... 其他欄位
}
```

- **單張圖片**：產品卡與詳情 modal 都會顯示
- **多張圖片**：產品卡顯示第一張，詳情 modal 可切換瀏覽
- **路徑**：相對於 `index.html`，例如 `images/產品代碼.jpg`
