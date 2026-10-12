(function () {
  "use strict";

  function config() {
    return window.BackendConfig || { sheetsWebAppUrl: "", sheetsEnabled: false };
  }

  async function post(payload) {
    const cfg = config();
    const url = String(cfg.sheetsWebAppUrl || "").trim();

    if (!url || !cfg.sheetsEnabled) {
      return { ok: false, skipped: true, reason: "not-configured" };
    }

    const body = JSON.stringify(payload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        redirect: "follow",
        credentials: "omit"
      });

      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}

      if (!response.ok) {
        throw new Error((data && data.message) || `HTTP ${response.status}`);
      }

      return { ok: true, verified: true, data };
    } catch (firstError) {
      // Apps Script บาง deployment ไม่ส่ง CORS header กลับมา
      // no-cors ยังส่ง POST ได้ แต่ browser จะอ่านผลตอบกลับไม่ได้
      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body,
          credentials: "omit"
        });
        return { ok: true, verified: false, warning: "opaque-response" };
      } catch (secondError) {
        console.error("[SheetsAPI] submit failed", firstError, secondError);
        return { ok: false, skipped: false, error: String(secondError?.message || firstError?.message || "ส่งข้อมูลไม่สำเร็จ") };
      }
    }
  }

  async function saveGameResult(result) {
    if (!result) return { ok: false, skipped: true, reason: "empty-result" };
    return post({
      action: "saveGameResult",
      sentAtIso: new Date().toISOString(),
      result
    });
  }

  async function healthCheck() {
    return post({ action: "health", sentAtIso: new Date().toISOString() });
  }

  window.SheetsAPI = { post, saveGameResult, healthCheck };
})();
