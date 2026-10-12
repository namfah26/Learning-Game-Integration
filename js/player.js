
(function () {
  "use strict";

  // ============================================================
  // 1. ข้อมูลจากเว็บไซต์
  // ============================================================

  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);

  const ctx = {
    title: params.get("title") || "เกมการเรียนรู้",
    rawUrl: params.get("url") || "",
    gameId: params.get("gameId") || "game",
    studentId: params.get("studentId") || "",
    studentName: params.get("studentName") || "",
    back: params.get("back") || "student",
    supportsTelemetry: params.get("telemetry") === "1"
  };

  const makeId = prefix => {
    if (window.AppData &&
        typeof AppData.makeId === "function") {
      return AppData.makeId(prefix);
    }

    return prefix + "-" + Date.now() + "-" +
      Math.random().toString(36).slice(2);
  };

  let launchSessionId =
    params.get("launchSessionId") || makeId("launch");

  let startedAt = Date.now();
  let telemetryReceived = false;
  let genericSaved = false;
  let currentGameUrl = "";

  const receivedResultIds = new Set();

  // ============================================================
  // 2. แสดงข้อมูลผู้เล่น
  // ============================================================

  $("gameTitle").textContent = ctx.title;

  $("playerSub").textContent = ctx.studentId
    ? "ผู้เล่น: " +
      (ctx.studentName || "นักเรียน") +
      " (" + ctx.studentId + ")"
    : "โหมดทดลองเล่นของคุณครู";

  document.title = ctx.title + " - เล่นเกม";

  // ============================================================
  // 3. สร้าง URL เกม และส่งข้อมูลนักเรียนให้ Unity
  // ============================================================

  function buildUrl() {
    const resolved = new URL(ctx.rawUrl, location.href);

    if (!["http:", "https:"].includes(resolved.protocol)) {
      throw new Error(
        "รองรับเกม Web ผ่าน http/https เท่านั้น"
      );
    }

    // ส่งข้อมูลผู้เล่นทุกครั้งที่เปิดเกม
    if (ctx.studentId) {
      resolved.searchParams.set(
        "studentId",
        ctx.studentId
      );

      resolved.searchParams.set(
        "studentName",
        ctx.studentName
      );
    }

    resolved.searchParams.set("gameId", ctx.gameId);
    resolved.searchParams.set("gameTitle", ctx.title);

    resolved.searchParams.set(
      "launchSessionId",
      launchSessionId
    );

    return resolved.href;
  }

  // ============================================================
  // 4. เปิดเกม
  // ============================================================

  function loadGame() {
    telemetryReceived = false;
    genericSaved = false;
    startedAt = Date.now();
    receivedResultIds.clear();

    $("savedBadge").style.display = "none";
    $("errorPanel").style.display = "none";

    try {
      currentGameUrl = buildUrl();
      $("gameFrame").src = currentGameUrl;

      console.log(
        "[Website] Opening game:",
        ctx.gameId
      );
    } catch (error) {
      console.error("[Website] Load error:", error);

      $("errorText").textContent =
        error.message || "URL เกมไม่ถูกต้อง";

      $("errorPanel").style.display = "grid";
    }
  }

  // ============================================================
  // 5. จัดรูปแบบเวลา
  // ============================================================

  function formatDuration(ms) {
    const total = Math.max(
      0,
      Math.floor(ms / 1000)
    );

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return (
      h + " ชั่วโมง " +
      m + " นาที " +
      s + " วินาที"
    );
  }

  // ============================================================
  // 6. เก็บข้อมูลเวลาเล่นสำหรับทุกเกม
  // ============================================================

  function saveGenericUsage(reason) {
    if (!ctx.studentId || genericSaved) {
      return;
    }

    const end = new Date();
    const start = new Date(startedAt);

    const durationMs = Math.max(
      0,
      end.getTime() - start.getTime()
    );

    if (durationMs < 1000) {
      return;
    }

    try {
      const list = AppData.readArray(
        "usageHistory"
      );

      const exists = list.some(item =>
        String(item.launchSessionId || "") ===
        String(launchSessionId)
      );

      if (exists) {
        genericSaved = true;
        return;
      }

      list.unshift({
        launchSessionId: launchSessionId,
        studentId: ctx.studentId,
        studentName: ctx.studentName,
        gameId: ctx.gameId,
        gameTitle: ctx.title,

        date: end.toLocaleDateString("th-TH"),
        startTime: start.toLocaleTimeString("th-TH"),
        endTime: end.toLocaleTimeString("th-TH"),

        duration: formatDuration(durationMs),
        durationMs: durationMs,

        createdAt: end.toISOString(),
        source: "generic-" + reason,
        hasTelemetry: telemetryReceived
      });

      AppData.writeArray(
        "usageHistory",
        list
      );

      genericSaved = true;

      console.log(
        "[Website] Usage saved:",
        ctx.gameId
      );
    } catch (error) {
      console.error(
        "[Website] Usage save error:",
        error
      );
    }
  }

  // ============================================================
  // 7. แปลง JSON ที่ Unity ส่งมาเป็นข้อมูลเว็บไซต์
  // ============================================================

  function normalizeGameResult(raw) {
    if (!raw || typeof raw !== "object" ||
        Array.isArray(raw)) {
      throw new Error(
        "ข้อมูลผลการเล่นไม่ถูกต้อง"
      );
    }

    const now = new Date();

    const mode = String(
      raw.mode || ""
    );

    // ใช้รหัสเกมตามโหมด Unity เมื่อส่งเป็น ThaiW
    const resultGameId = String(
      raw.gameId || ctx.gameId
    );

    const resultId = String(
      raw.resultId || makeId("result")
    );

    const result = {
      ...raw,

      resultId: resultId,

      gameId: resultGameId,
      gameTitle: ctx.title,

      mode: mode,

      // ใช้ข้อมูลผู้เล่นจากเว็บไซต์เป็นหลัก
      studentId: ctx.studentId,
      studentName: ctx.studentName,

      playerName:
        ctx.studentName ||
        raw.playerName ||
        "ผู้เล่น",

      launchSessionId: launchSessionId,

      date: now.toLocaleDateString("th-TH"),
      createdAt: now.toISOString(),

      source: "unity-webgl"
    };

    // คงคะแนนเป็นตัวเลขถ้าเกมส่งมา
    if (raw.score !== undefined &&
        raw.score !== null &&
        raw.score !== "") {
      const score = Number(raw.score);

      if (Number.isFinite(score)) {
        result.score = score;
      }
    }

    return result;
  }

  // ============================================================
  // 8. บันทึก JSON ลงประวัติผลการเล่น
  // ============================================================

  function saveGameResultLocally(result) {
    if (!ctx.studentId) {
      console.warn(
        "[Website] ไม่มีรหัสนักเรียน " +
        "จึงไม่บันทึกผลลงประวัตินักเรียน"
      );

      return false;
    }

    const list = AppData.readArray(
      "gameResults"
    );

    const exists = list.some(item =>
      String(item.resultId || "") ===
      String(result.resultId)
    );

    if (!exists) {
      list.unshift(result);

      AppData.writeArray(
        "gameResults",
        list
      );
    }

    return true;
  }

  // ============================================================
  // 9. รับผลจาก Unity และเกมอื่น
  // ============================================================

  async function handleGameResult(raw) {
    let result;

    try {
      result = normalizeGameResult(raw);
    } catch (error) {
      console.error(
        "[Website] Invalid result:",
        error
      );
      return;
    }

    if (receivedResultIds.has(result.resultId)) {
      return;
    }

    receivedResultIds.add(result.resultId);

    console.log(
      "[Website] Game JSON received:",
      result
    );

    let localSaved = false;

    try {
      localSaved = saveGameResultLocally(
        result
      );
    } catch (error) {
      console.error(
        "[Website] Local result save failed:",
        error
      );
    }

    telemetryReceived = true;

    if (localSaved) {
      $("savedBadge").style.display =
        "inline-flex";

      $("savedBadge").textContent =
        "✓ บันทึกผลในเครื่องแล้ว";
    }

    // ส่งผลไปยังหน้าที่เปิดเกม
    if (window.opener &&
        !window.opener.closed) {
      try {
        window.opener.postMessage(
          {
            type: "learning-game-result",
            result: result
          },
          location.origin
        );
      } catch (error) {
        console.warn(
          "[Website] Forward result failed:",
          error
        );
      }
    }

    // ส่งผลไปยังระบบจัดเก็บส่วนกลาง
    // ถ้าเว็บไซต์ติดตั้ง SheetsAPI ไว้
    if (window.SheetsAPI &&
        typeof window.SheetsAPI.saveGameResult ===
          "function") {
      try {
        const status =
          await window.SheetsAPI.saveGameResult(
            result
          );

        if (status && status.ok) {
          $("savedBadge").style.display =
            "inline-flex";

          $("savedBadge").textContent =
            "✓ บันทึกผลแล้ว";
        } else {
          console.warn(
            "[Website] Remote save not confirmed:",
            status
          );
        }
      } catch (error) {
        console.error(
          "[Website] Remote save error:",
          error
        );
      }
    }
  }

  // ============================================================
  // 10. รับข้อความจาก iframe เกม
  // ============================================================

  window.addEventListener(
    "message",
    function (event) {

      // รับเฉพาะข้อความจาก iframe ของเกม
      if (event.source !==
          $("gameFrame").contentWindow) {
        return;
      }

      // รองรับเฉพาะเกมที่อยู่ origin เดียวกับเว็บ
      if (event.origin !== location.origin) {
        return;
      }

      const msg = event.data || {};

      // Unity WebGL
      if (
        msg.type === "UNITY_GAME_RESULT" &&
        msg.result
      ) {
        handleGameResult(msg.result);
        return;
      }

      // รูปแบบจากเกมเว็บไซต์อื่น
      if (
        msg.type === "learning-game-result" &&
        msg.result
      ) {
        handleGameResult(msg.result);
        return;
      }

      if (msg.type === "learning-game-exit") {
        exitGame();
        return;
      }

      if (msg.type === "learning-game-replay") {
        replay();
        return;
      }
    }
  );

  // ============================================================
  // 11. ออกจากเกม
  // ============================================================

  function closeOrReturn() {
    const backUrl =
      ctx.back === "teacher"
        ? "./teacher.html"
        : "./student.html";

    try {
      if (window.opener &&
          !window.opener.closed) {

        window.opener.postMessage(
          {
            type: "learning-game-player-closed"
          },
          location.origin
        );

        window.close();

        setTimeout(() => {
          location.href = backUrl;
        }, 250);

        return;
      }
    } catch (error) {
      console.warn(
        "[Website] Close error:",
        error
      );
    }

    location.href = backUrl;
  }

  function exitGame() {
    saveGenericUsage("exit");
    closeOrReturn();
  }

  // ============================================================
  // 12. เล่นใหม่
  // ============================================================

  function replay() {
    saveGenericUsage("replay");

    launchSessionId = makeId("launch");

    loadGame();
  }

  // ============================================================
  // 13. เต็มจอ
  // ============================================================

  $("fullscreenBtn").addEventListener(
    "click",
    async function () {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await $("gameFrame").requestFullscreen();
        }
      } catch (error) {
        alert(
          "ไม่สามารถเปิดเต็มจอได้ " +
          "กรุณาลองอีกครั้ง"
        );
      }
    }
  );

  document.addEventListener(
    "fullscreenchange",
    function () {
      $("fullscreenBtn").textContent =
        document.fullscreenElement
          ? "✕ ออกจากเต็มจอ"
          : "⛶ เต็มจอ";
    }
  );

  // ============================================================
  // 14. ปุ่มออกจากเกม
  // ============================================================

  $("exitBtn").addEventListener(
    "click",
    exitGame
  );

  // ============================================================
  // 15. บันทึกเมื่อปิดหน้า
  // ============================================================

  window.addEventListener(
    "pagehide",
    function () {
      saveGenericUsage("close");
    }
  );

  // ============================================================
  // 16. เปิดให้หน้าเว็บอื่นเรียกใช้งาน
  // ============================================================

  window.PlayerApp = {
    exitGame: exitGame,
    replay: replay
  };

  // ============================================================
  // 17. เริ่มต้นเปิดเกม
  // ============================================================

  if (!ctx.rawUrl) {
    $("errorText").textContent =
      "ไม่พบ URL ของเกม";

    $("errorPanel").style.display = "grid";
  } else {
    loadGame();
  }

})();
