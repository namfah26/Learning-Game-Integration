(function () {
  "use strict";

  // วาง URL ที่ได้จาก Google Apps Script Web App ตรงนี้
  // ตัวอย่าง: https://script.google.com/macros/s/AKfycb.../exec
  const SHEETS_WEB_APP_URL = "";

  window.BackendConfig = {
    sheetsWebAppUrl: SHEETS_WEB_APP_URL,
    sheetsEnabled: Boolean(SHEETS_WEB_APP_URL.trim())
  };
})();
