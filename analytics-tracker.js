/**
 * 目錄頁埋點腳本：將瀏覽、點擊、詢盤等事件發送到後台
 * 使用前請在頁面設定：window.ANALYTICS_API_URL
 */
(function () {
  const API_URL = window.ANALYTICS_API_URL || "";
  const sessionId = "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
  let pageViewTime = 0;

  function send(eventType, payload) {
    if (API_URL === undefined || API_URL === null) return;
    const base = (API_URL || window.location.origin).replace(/\/$/, "");
    const url = base + "/api/analytics/event";
    const payloadStr = JSON.stringify({
      type: eventType,
      payload: payload,
      timestamp: new Date().toISOString(),
      page: window.location.pathname || "/",
      sessionId: sessionId,
    });
    // 優先使用 fetch + keepalive（Content-Type 固定為 JSON，Netlify Function 的 req.json() 較穩定）
    // sendBeacon 搭配 Blob 在部分環境下後端可能無法正確解析為 JSON
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payloadStr,
      keepalive: true,
    };
    if (typeof fetch === "function") {
      fetch(url, opts).catch(function () {
        if (navigator.sendBeacon) {
          var blob = new Blob([payloadStr], { type: "application/json" });
          navigator.sendBeacon(url, blob);
        }
      });
    } else if (navigator.sendBeacon) {
      var b = new Blob([payloadStr], { type: "application/json" });
      navigator.sendBeacon(url, b);
    }
  }

  window.trackEvent = function (type, payload) {
    send(type, payload || {});
  };

  window.trackPageView = function () {
    pageViewTime = Date.now();
    send("page_view", {});
  };

  window.trackPageLeave = function () {
    const durationSec = Math.round((Date.now() - pageViewTime) / 1000);
    send("page_leave", { durationSec: durationSec });
  };

  window.trackProductClick = function (productCode, productName) {
    send("product_click", { productCode: productCode, productName: productName || "" });
  };

  window.trackInquiry = function (productCode, type) {
    send("inquiry_click", { productCode: productCode, type: type || "copy" });
  };

  window.trackPageView();

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") window.trackPageLeave();
  });
  window.addEventListener("pagehide", function () {
    window.trackPageLeave();
  });
})();
