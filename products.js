// 凍肉水產商品資料

// 監控中曾出現的產品編號對照（若不在下方 PRODUCTS 中，在此補充以顯示產品名字）

window.ANALYTICS_CODE_NAMES = {

  "CN-CH-001": "高峰四肉/中國二肉",

  "BR-BF-001": "巴西牛肉1",

  "BR-BF-002": "巴西牛肉2",

  "CN-PK-003": "中國三肉 9-13條",

  "CN-CK-001": "欣城50+中翼",

  "HK-SCY-001": "酸菜魚",

  "HK-NW-001": "牛丸",

};

//

// 添加產品圖片：在產品物件中加入 images 陣列，例如：

//   images: ["images/CN-PK-001-1.jpg", "images/CN-PK-001-2.jpg"]

// 圖片請放在 catalog-frozen/images/ 資料夾，路徑相對於 index.html

// 若無 images，會顯示預設佔位圖

//

// —— 期貨物流 ——

// logistics.live === true：詳情頁請求 /api/shipping/track。運營在 dashboard 可：

//    · 自動：綁定櫃號(CT) / 訂艙(BK) / 提單(BL) 之一（SeaRates）；可選填船名、航次作展示補充。

//    · 手動：維護船名、航次、狀態(航行/靠泊/到港)、ETA、目的港等（僅船名航次時以此為準）。

// 客戶無需輸入櫃號／提單／船名。live 時標題以 API 為準；可選 dataNote 附註（會接在 API 說明後）。

//

window.PRODUCTS = [

  {

    code: "CN-PK-001",

    name: "高峰四肉/中國二肉",

    images: ["images/高峰四肉.jpg", "images/中國二肉.jpg"],

    category: "中國豬肉",

    specLines: ["高峰四肉3-4塊", "中國二肉6-7塊"],

    price: "200箱以上 $21.2/kg；200箱以下 $21.7/kg",

    leadTime: "4月/5月",

    available: true,

    popularity: 90,

    logistics: {

      live: true,

      dataNote: "具體靠泊與提货時間以港務及船公司為準。",

    },

  },

  {

    code: "CN-PK-002",

    name: "中國大排 5-7條",

    images: ["images/中國大排.jpg", "images/中国大排1.jpg"],

    category: "中國豬肉",

    specLines: ["25kg/箱"],

    price: "$20.5/kg ($9.3/LB)",

    leadTime: "4月/5月",

    available: true,

    popularity: 80,

    logistics: {

      live: true,

    },

  },

  {

    code: "CN-PK-003",

    name: "中國三肉 9-13條",

    images: ["images/CN-PK-003-sanrou.png"],

    category: "中國豬肉",

    specLines: ["9-13條"],

    price: "$23.8/kg ($10.8/LB)",

    leadTime: "4月/5月",

    available: true,

    popularity: 82,

  },

  {

    code: "CN-CK-001",

    name: "欣城50+中翼",

    images: ["images/CN-CK-001-wing.jpeg"],

    category: "中國雞類",

    specLines: ["50+中翼"],

    price: "到取價 $51.2/kg",

    leadTime: "4月中下旬",

    available: true,

    popularity: 78,

  },

];


