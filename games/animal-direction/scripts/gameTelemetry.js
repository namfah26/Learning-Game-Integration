import { TELEMETRY_CONFIG } from "./telemetry-config.js";

console.log("[ArrowGame] integrated telemetry worker v4 loaded");

const GAME_LAYOUT = "Layout 7 Game";
const WIN_LAYOUT = "Layout 9 Win";
const GAMEOVER_LAYOUT = "Layout 8 GameOver";
const MAIN_LAYOUT = "Layout 5 Mainmenu";
const DIR_BY_VALUE = { 0: "left", 1: "right", 2: "up", 3: "down" };
const DIRECTIONS = ["up", "down", "left", "right"];
const ACTIVE_KEY = `${TELEMETRY_CONFIG.storagePrefix}.active`;
const PENDING_KEY = `${TELEMETRY_CONFIG.storagePrefix}.pending`;

function clampPct(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function average(values) {
  const nums = values.filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function median(values) {
  const nums = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!nums.length) return 0;
  const m = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[m] : (nums[m - 1] + nums[m]) / 2;
}

function isoNow() {
  return new Date().toISOString();
}

function makeId() {
  try {
    return crypto.randomUUID();
  } catch (_) {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyDirectionStats() {
  return {
    up: { presented: 0, attempted: 0, correct: 0, wrong: 0, pct: 0 },
    down: { presented: 0, attempted: 0, correct: 0, wrong: 0, pct: 0 },
    left: { presented: 0, attempted: 0, correct: 0, wrong: 0, pct: 0 },
    right: { presented: 0, attempted: 0, correct: 0, wrong: 0, pct: 0 }
  };
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function readGlobals(runtime) {
  const g = runtime.globalVars;
  return {
    score: safeNumber(g.Score),
    level: safeNumber(g.Level, 1),
    currentIndex: safeNumber(g.CurrentIndex),
    sequenceLength: safeNumber(g.SequenceLength),
    timeLeft: safeNumber(g.TimeLeft),
    correct: safeNumber(g.CorrectClick),
    wrong: safeNumber(g.WrongClick),
    other: safeNumber(g.OtherClick),
    levelCorrect: safeNumber(g.LevelCorrect),
    levelWrong: safeNumber(g.LevelWrong),
    totalTime: safeNumber(g.TotalTime),
    isLevelChanging: safeNumber(g.IsLevelChanging),
    selectedCharacter: String(g.SelectedCharacter ?? ""),
    username: String(g.Username ?? "")
  };
}

function getObject(runtime, name) {
  try {
    return runtime.objects[name]?.getFirstInstance?.() ?? null;
  } catch (_) {
    return null;
  }
}

function getInputText(runtime, name) {
  try {
    const inst = getObject(runtime, name);
    return String(inst?.text ?? "").trim();
  } catch (_) {
    return "";
  }
}

function getMouseState(runtime) {
  try {
    const [x, y] = runtime.mouse.getMousePosition();
    return { down: !!runtime.mouse.isMouseButtonDown(0), x, y };
  } catch (_) {
    return { down: false, x: null, y: null };
  }
}

function directionAtPoint(runtime, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "other";
  const map = [
    ["up", "BtnUp"],
    ["down", "BtnDown"],
    ["left", "BtnLeft"],
    ["right", "BtnRight"]
  ];
  for (const [direction, objectName] of map) {
    try {
      const inst = getObject(runtime, objectName);
      if (inst?.containsPoint?.(x, y)) return direction;
    } catch (_) {}
  }
  return "other";
}

function readSequence(runtime, length) {
  try {
    const arr = getObject(runtime, "Array");
    if (!arr || arr.width < length || length <= 0) return null;
    const seq = [];
    for (let i = 0; i < length; i++) {
      seq.push(DIR_BY_VALUE[safeNumber(arr.getAt(i), -1)] ?? "unknown");
    }
    return seq;
  } catch (_) {
    return null;
  }
}

function postChannel(channel, type, payload = {}) {
  try {
    channel?.postMessage({ type, ...payload });
  } catch (_) {}
}

runOnStartup(async runtime => {
  const channel = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(TELEMETRY_CONFIG.channelName)
    : null;

  let externalPlayerContext = { studentId: "", studentName: "" };
  channel?.addEventListener("message", event => {
    const msg = event.data || {};
    if (msg.type !== "player-context") return;
    externalPlayerContext = {
      studentId: String(msg.context?.studentId || "").trim(),
      studentName: String(msg.context?.studentName || "").trim()
    };
    if (externalPlayerContext.studentName) {
      applyExternalPlayerToMainMenu();
    }
  });

  let currentLayout = "";
  let previousGlobals = readGlobals(runtime);
  let previousMouse = { down: false, x: null, y: null };
  let lastMainMenuName = "";
  let session = null;
  let activeStage = null;
  let activeStageSequence = null;
  let stageStartedPerf = 0;
  let sessionStartedPerf = 0;
  let lastScoredPerf = 0;
  let lastAnyClickPerf = 0;
  let lastPointer = { x: null, y: null, clickedDirection: "other", perf: 0 };
  let finalReportSent = false;
  let saveInProgress = false;
  let lastSnapshotPerf = 0;

  async function storageGet(key, fallback) {
    try {
      const v = await runtime.storage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  async function storageSet(key, value) {
    try {
      await runtime.storage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn("[Telemetry] storage set failed", err);
      return false;
    }
  }

  async function storageRemove(key) {
    try {
      await runtime.storage.removeItem(key);
    } catch (_) {}
  }

  function startSession(g) {
    const nowPerf = performance.now();
    sessionStartedPerf = nowPerf;
    lastAnyClickPerf = nowPerf;
    lastScoredPerf = nowPerf;
    session = {
      sessionId: makeId(),
      playerName: externalPlayerContext.studentName || lastMainMenuName || g.username || "",
      username: externalPlayerContext.studentName || g.username || "",
      character: g.selectedCharacter || "",
      startedAtIso: isoNow(),
      endedAtIso: "",
      status: "playing",
      finalLevel: g.level,
      score: 0,
      correctClicks: 0,
      wrongClicks: 0,
      otherClicks: 0,
      totalClicks: 0,
      gameTotalTimeSec: 0,
      measuredDurationMs: 0,
      overallAccuracyPct: 0,
      scorePct: 0,
      upPct: 0,
      downPct: 0,
      leftPct: 0,
      rightPct: 0,
      avgReactionMs: 0,
      medianReactionMs: 0,
      stagesCompleted: 0,
      appVersion: TELEMETRY_CONFIG.appVersion,
      stages: [],
      clicks: [],
      saved: false
    };
    activeStage = null;
    activeStageSequence = null;
    finalReportSent = false;
    void storageSet(ACTIVE_KEY, clone(session));
    postChannel(channel, "session-started", { sessionId: session.sessionId });
  }

  function startStage(g) {
    if (!session || activeStage) return;
    const sequence = readSequence(runtime, g.sequenceLength);
    if (!sequence) return;
    const nowPerf = performance.now();
    stageStartedPerf = nowPerf;
    lastScoredPerf = nowPerf;
    activeStageSequence = sequence;
    activeStage = {
      sessionId: session.sessionId,
      playerName: session.playerName,
      character: session.character,
      level: g.level,
      status: "playing",
      startedAtIso: isoNow(),
      endedAtIso: "",
      durationMs: 0,
      sequenceLength: g.sequenceLength,
      scoreStart: g.score,
      scoreEnd: g.score,
      scoreGained: 0,
      correctClicks: 0,
      wrongClicks: 0,
      otherClicks: 0,
      totalClicks: 0,
      accuracyPct: 0,
      scorePct: 0,
      avgReactionMs: 0,
      directionStats: emptyDirectionStats()
    };
    for (const direction of sequence) {
      if (activeStage.directionStats[direction]) activeStage.directionStats[direction].presented++;
    }
  }

  function finalizeStage(g, status) {
    if (!session || !activeStage) return;
    const nowPerf = performance.now();
    activeStage.status = status;
    activeStage.endedAtIso = isoNow();
    activeStage.durationMs = Math.max(0, Math.round(nowPerf - stageStartedPerf));
    activeStage.scoreEnd = g.score;
    activeStage.scoreGained = Math.max(0, g.score - activeStage.scoreStart);
    activeStage.totalClicks = activeStage.correctClicks + activeStage.wrongClicks + activeStage.otherClicks;
    activeStage.accuracyPct = clampPct((activeStage.correctClicks / Math.max(1, activeStage.sequenceLength)) * 100);
    activeStage.scorePct = clampPct((activeStage.scoreGained / Math.max(1, activeStage.sequenceLength)) * 100);

    const stageReaction = session.clicks
      .filter(c => c.level === activeStage.level && (c.result === "correct" || c.result === "wrong"))
      .map(c => c.responseTimeMs);
    activeStage.avgReactionMs = Math.round(average(stageReaction));

    for (const direction of DIRECTIONS) {
      const d = activeStage.directionStats[direction];
      d.wrong = Math.max(0, d.presented - d.correct);
      d.pct = clampPct((d.correct / Math.max(1, d.presented)) * 100);
    }

    session.stages.push(clone(activeStage));
    if (status === "completed") session.stagesCompleted++;
    activeStage = null;
    activeStageSequence = null;
  }

  function updateIdentity(g) {
    if (!session) return;
    if (externalPlayerContext.studentName) {
      session.playerName = externalPlayerContext.studentName;
      session.username = externalPlayerContext.studentName;
    } else {
      if (!session.playerName) session.playerName = lastMainMenuName || g.username || "";
      if (!session.username && g.username) session.username = g.username;
    }
    if (!session.character && g.selectedCharacter) session.character = g.selectedCharacter;
    if (activeStage) {
      activeStage.playerName = session.playerName;
      activeStage.character = session.character;
    }
  }

  function applyExternalPlayerToMainMenu() {
    const name = String(externalPlayerContext.studentName || "").trim();
    if (!name) return;
    lastMainMenuName = name;
    try { runtime.globalVars.Username = name; } catch (_) {}
    try {
      const input = getObject(runtime, "PlayerNameInput");
      if (input) {
        input.text = name;
        input.isVisible = false;
      }
    } catch (_) {}
  }

  function capturePointer(mouse) {
    const nowPerf = performance.now();
    lastPointer = {
      x: Number.isFinite(mouse.x) ? Math.round(mouse.x * 100) / 100 : null,
      y: Number.isFinite(mouse.y) ? Math.round(mouse.y * 100) / 100 : null,
      clickedDirection: directionAtPoint(runtime, mouse.x, mouse.y),
      perf: nowPerf
    };
  }

  function addClick(result, g, prevG, count = 1) {
    if (!session || !activeStage) return;
    for (let k = 0; k < count; k++) {
      const nowPerf = performance.now();
      const trialIndex = result === "other" ? prevG.currentIndex : Math.max(0, prevG.currentIndex + k);
      const targetDirection = activeStageSequence?.[trialIndex] ?? "unknown";
      let clickedDirection = lastPointer.clickedDirection;
      if (result === "correct" && clickedDirection === "other") clickedDirection = targetDirection;

      const click = {
        sessionId: session.sessionId,
        playerName: session.playerName,
        level: activeStage.level,
        clickNo: session.clicks.length + 1,
        trialIndex,
        timestampIso: isoNow(),
        elapsedSessionMs: Math.max(0, Math.round(nowPerf - sessionStartedPerf)),
        elapsedStageMs: Math.max(0, Math.round(nowPerf - stageStartedPerf)),
        responseTimeMs: Math.max(0, Math.round(nowPerf - lastScoredPerf)),
        sincePreviousClickMs: Math.max(0, Math.round(nowPerf - lastAnyClickPerf)),
        result,
        targetDirection,
        clickedDirection,
        x: lastPointer.x,
        y: lastPointer.y,
        scoreAfter: g.score,
        correctTotal: g.correct,
        wrongTotal: g.wrong,
        otherTotal: g.other,
        currentIndexAfter: g.currentIndex
      };
      session.clicks.push(click);
      lastAnyClickPerf = nowPerf;
      if (result !== "other") lastScoredPerf = nowPerf;

      if (result === "correct") activeStage.correctClicks++;
      else if (result === "wrong") activeStage.wrongClicks++;
      else activeStage.otherClicks++;

      if (result === "correct" || result === "wrong") {
        const d = activeStage.directionStats[targetDirection];
        if (d) {
          d.attempted++;
          if (result === "correct") d.correct++;
        }
      }
    }
  }

  function buildReport(g, finalStatus) {
    if (!session) return null;
    const nowPerf = performance.now();
    const dirAgg = emptyDirectionStats();
    let totalExpected = 0;
    let totalScore = 0;
    for (const st of session.stages) {
      totalExpected += st.sequenceLength;
      totalScore += st.scoreGained;
      for (const direction of DIRECTIONS) {
        const src = st.directionStats[direction];
        const dst = dirAgg[direction];
        dst.presented += src.presented;
        dst.attempted += src.attempted;
        dst.correct += src.correct;
      }
    }
    for (const direction of DIRECTIONS) {
      const d = dirAgg[direction];
      d.wrong = Math.max(0, d.presented - d.correct);
      d.pct = clampPct((d.correct / Math.max(1, d.presented)) * 100);
    }

    const scoredClicks = session.clicks.filter(c => c.result === "correct" || c.result === "wrong");
    const reactionTimes = scoredClicks.map(c => c.responseTimeMs);
    session.endedAtIso = isoNow();
    session.status = finalStatus;
    session.finalLevel = g.level;
    session.score = g.score;
    session.correctClicks = g.correct;
    session.wrongClicks = g.wrong;
    session.otherClicks = g.other;
    session.totalClicks = g.correct + g.wrong + g.other;
    session.gameTotalTimeSec = g.totalTime;
    session.measuredDurationMs = Math.max(0, Math.round(nowPerf - sessionStartedPerf));
    session.overallAccuracyPct = clampPct((g.correct / Math.max(1, g.correct + g.wrong)) * 100);
    session.scorePct = clampPct((totalScore / Math.max(1, totalExpected)) * 100);
    session.upPct = dirAgg.up.pct;
    session.downPct = dirAgg.down.pct;
    session.leftPct = dirAgg.left.pct;
    session.rightPct = dirAgg.right.pct;
    session.avgReactionMs = Math.round(average(reactionTimes));
    session.medianReactionMs = Math.round(median(reactionTimes));

    const stages = session.stages.map(st => ({
      ...st,
      radar: {
        up: st.directionStats.up.pct,
        down: st.directionStats.down.pct,
        left: st.directionStats.left.pct,
        right: st.directionStats.right.pct,
        score: st.scorePct
      }
    }));

    return {
      session: clone(session),
      overallRadar: {
        up: session.upPct,
        down: session.downPct,
        left: session.leftPct,
        right: session.rightPct,
        score: session.scorePct
      },
      stages
    };
  }

  function flattenForUpload(report) {
    const s = report.session;
    const sessionRow = {
      sessionId: s.sessionId,
      playerName: s.playerName,
      username: s.username,
      character: s.character,
      startedAtIso: s.startedAtIso,
      endedAtIso: s.endedAtIso,
      status: s.status,
      finalLevel: s.finalLevel,
      score: s.score,
      correctClicks: s.correctClicks,
      wrongClicks: s.wrongClicks,
      otherClicks: s.otherClicks,
      totalClicks: s.totalClicks,
      gameTotalTimeSec: s.gameTotalTimeSec,
      measuredDurationMs: s.measuredDurationMs,
      overallAccuracyPct: s.overallAccuracyPct,
      scorePct: s.scorePct,
      upPct: s.upPct,
      downPct: s.downPct,
      leftPct: s.leftPct,
      rightPct: s.rightPct,
      avgReactionMs: s.avgReactionMs,
      medianReactionMs: s.medianReactionMs,
      stagesCompleted: s.stagesCompleted,
      appVersion: s.appVersion
    };

    const stageSummary = report.stages.map(st => ({
      sessionId: st.sessionId,
      playerName: st.playerName,
      character: st.character,
      level: st.level,
      status: st.status,
      startedAtIso: st.startedAtIso,
      endedAtIso: st.endedAtIso,
      durationMs: st.durationMs,
      sequenceLength: st.sequenceLength,
      scoreStart: st.scoreStart,
      scoreEnd: st.scoreEnd,
      scoreGained: st.scoreGained,
      correctClicks: st.correctClicks,
      wrongClicks: st.wrongClicks,
      otherClicks: st.otherClicks,
      totalClicks: st.totalClicks,
      accuracyPct: st.accuracyPct,
      scorePct: st.scorePct,
      avgReactionMs: st.avgReactionMs,
      upPresented: st.directionStats.up.presented,
      upCorrect: st.directionStats.up.correct,
      upWrong: st.directionStats.up.wrong,
      upPct: st.directionStats.up.pct,
      downPresented: st.directionStats.down.presented,
      downCorrect: st.directionStats.down.correct,
      downWrong: st.directionStats.down.wrong,
      downPct: st.directionStats.down.pct,
      leftPresented: st.directionStats.left.presented,
      leftCorrect: st.directionStats.left.correct,
      leftWrong: st.directionStats.left.wrong,
      leftPct: st.directionStats.left.pct,
      rightPresented: st.directionStats.right.presented,
      rightCorrect: st.directionStats.right.correct,
      rightWrong: st.directionStats.right.wrong,
      rightPct: st.directionStats.right.pct
    }));

    return {
      type: "game_session_bundle",
      savedAtIso: isoNow(),
      sessions: [sessionRow],
      stageSummary,
      clickEvents: report.session.clicks
    };
  }

  async function attemptUpload(bundle) {
    const url = String(TELEMETRY_CONFIG.endpointUrl || "").trim();
    if (!url) return { ok: false, reason: "endpoint-not-configured" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEMETRY_CONFIG.requestTimeoutMs || 12000);
    try {
      const options = {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(bundle),
        signal: controller.signal
      };
      if (TELEMETRY_CONFIG.useNoCors) options.mode = "no-cors";
      await fetch(url, options);
      return { ok: true };
    } catch (err) {
      console.warn("[Telemetry] upload failed", err);
      return { ok: false, reason: String(err?.message || err) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function flushPending() {
    const pending = await storageGet(PENDING_KEY, []);
    if (!Array.isArray(pending) || !pending.length || !TELEMETRY_CONFIG.endpointUrl) return;
    const remaining = [];
    for (const item of pending) {
      const result = await attemptUpload(item);
      if (!result.ok) remaining.push(item);
    }
    await storageSet(PENDING_KEY, remaining);
  }

  async function saveReport(report) {
    if (!report || saveInProgress) return;
    saveInProgress = true;
    postChannel(channel, "save-status", { status: "saving" });
    try {
      const bundle = flattenForUpload(report);
      const pending = await storageGet(PENDING_KEY, []);
      const queue = Array.isArray(pending) ? pending : [];
      if (!queue.some(x => x?.sessions?.[0]?.sessionId === session.sessionId)) queue.push(bundle);
      await storageSet(PENDING_KEY, queue);
      await storageSet(`${TELEMETRY_CONFIG.storagePrefix}.lastReport`, report);

      const result = await attemptUpload(bundle);
      if (result.ok) {
        const latest = await storageGet(PENDING_KEY, []);
        const cleaned = Array.isArray(latest)
          ? latest.filter(x => x?.sessions?.[0]?.sessionId !== session.sessionId)
          : [];
        await storageSet(PENDING_KEY, cleaned);
        await storageRemove(ACTIVE_KEY);
        session.saved = true;
        postChannel(channel, "save-status", { status: "saved", mode: "sheet" });
      } else {
        await storageRemove(ACTIVE_KEY);
        session.saved = true;
        postChannel(channel, "save-status", {
          status: "saved-local",
          mode: "local",
          reason: result.reason
        });
      }
    } finally {
      saveInProgress = false;
    }
  }

  async function maybeSnapshot() {
    const nowPerf = performance.now();
    if (!session || nowPerf - lastSnapshotPerf < 2000) return;
    lastSnapshotPerf = nowPerf;
    await storageSet(ACTIVE_KEY, clone(session));
  }

  function resetCurrentSession({ removeActive = true } = {}) {
    session = null;
    activeStage = null;
    activeStageSequence = null;
    stageStartedPerf = 0;
    sessionStartedPerf = 0;
    lastScoredPerf = 0;
    lastAnyClickPerf = 0;
    lastSnapshotPerf = 0;
    lastPointer = { x: null, y: null, clickedDirection: "other", perf: 0 };
    finalReportSent = false;
    saveInProgress = false;

    postChannel(channel, "hide-report");

    if (removeActive) {
      void storageRemove(ACTIVE_KEY);
    }

    void storageRemove(`${TELEMETRY_CONFIG.storagePrefix}.lastReport`);
  }

  function handleLayoutChange(nextLayout, g) {
    const wasFinal =
      currentLayout === WIN_LAYOUT ||
      currentLayout === GAMEOVER_LAYOUT;

    const isFinal =
      nextLayout === WIN_LAYOUT ||
      nextLayout === GAMEOVER_LAYOUT;

    if (wasFinal && nextLayout === MAIN_LAYOUT) {
      // ใช้ปุ่ม MainmenuButton เดิมของเกมเป็นปุ่มออกจากเกมเมื่อเปิดผ่านระบบนักเรียน
      postChannel(channel, "request-exit");
    }

    if (wasFinal && !isFinal) {
      resetCurrentSession({
        removeActive: nextLayout !== GAME_LAYOUT
      });
    }

    if (
      currentLayout === GAME_LAYOUT &&
      nextLayout !== GAME_LAYOUT &&
      session
    ) {
      if (activeStage) {
        finalizeStage(
          g,
          nextLayout === GAMEOVER_LAYOUT ? "timeout" : "ended"
        );
      }

      const finalStatus =
        nextLayout === WIN_LAYOUT
          ? "completed"
          : nextLayout === GAMEOVER_LAYOUT
            ? "gameover"
            : "abandoned";

      const report =
        buildReport(
          g,
          finalStatus
        );

      if (
        report &&
        isFinal
      ) {
        finalReportSent = true;

        postChannel(
          channel,
          "show-report",
          { report }
        );

        void storageSet(
          `${TELEMETRY_CONFIG.storagePrefix}.lastReport`,
          report
        );
      }
    }

    if (
      nextLayout === GAME_LAYOUT &&
      currentLayout !== GAME_LAYOUT
    ) {
      if (
        !session ||
        session.status !== "playing"
      ) {
        startSession(g);
      }
    }

    if (nextLayout === MAIN_LAYOUT) {
      if (externalPlayerContext.studentName) {
        applyExternalPlayerToMainMenu();
      } else {
        const input = getInputText(runtime, "PlayerNameInput");
        if (input) lastMainMenuName = input;
      }
    }

    currentLayout = nextLayout;
  }

  function tickGame(g, mouse) {
    if (!session) startSession(g);
    updateIdentity(g);
    if (!activeStage && g.isLevelChanging === 0) startStage(g);

    if (mouse.down && !previousMouse.down) capturePointer(mouse);

    if (activeStage) {
      const dCorrect = Math.max(0, g.correct - previousGlobals.correct);
      const dWrong = Math.max(0, g.wrong - previousGlobals.wrong);
      const dOther = Math.max(0, g.other - previousGlobals.other);
      if (dCorrect) addClick("correct", g, previousGlobals, dCorrect);
      if (dWrong) addClick("wrong", g, previousGlobals, dWrong);
      if (dOther) addClick("other", g, previousGlobals, dOther);

      if (previousGlobals.isLevelChanging === 0 && g.isLevelChanging === 1) {
        finalizeStage(g, "completed");
      }
    }

    if (previousGlobals.isLevelChanging === 1 && g.isLevelChanging === 0 && !activeStage) {
      startStage(g);
    }

    void maybeSnapshot();
  }

  function hideFinalObjects() {
    const names = [
      "TotalScore",
      "CorrectC",
      "WrongC",
      "OtherC",
      "TotalC",
      "TotalTime",
      "Savebt"
    ];

    for (const name of names) {
      try {
        const objectClass =
          runtime.objects[name];

        if (!objectClass?.getAllInstances) {
          continue;
        }

        for (const inst of objectClass.getAllInstances()) {
          inst.isVisible = false;
        }
      } catch (_) {}
    }
  }

  function handleFinalScreen(g) {
    if (!session) {
      return;
    }

    hideFinalObjects();

    if (!finalReportSent) {
      const report =
        buildReport(
          g,
          currentLayout === WIN_LAYOUT
            ? "completed"
            : "gameover"
        );

      if (report) {
        finalReportSent = true;

        postChannel(
          channel,
          "show-report",
          { report }
        );

        void storageSet(
          `${TELEMETRY_CONFIG.storagePrefix}.lastReport`,
          report
        );
      }
    }
  }

  runtime.addEventListener("tick", () => {
    let layoutName = "";
    try {
      layoutName = runtime.layout.name;
    } catch (_) {
      return;
    }

    const g = readGlobals(runtime);
    const mouse = getMouseState(runtime);

    if (layoutName === MAIN_LAYOUT) {
      if (externalPlayerContext.studentName) {
        applyExternalPlayerToMainMenu();
      } else {
        const input = getInputText(runtime, "PlayerNameInput");
        if (input) lastMainMenuName = input;
      }
    }

    if (layoutName !== currentLayout) handleLayoutChange(layoutName, g);

    if (layoutName === GAME_LAYOUT) tickGame(g, mouse);
    else if (layoutName === WIN_LAYOUT || layoutName === GAMEOVER_LAYOUT) handleFinalScreen(g);

    previousGlobals = g;
    previousMouse = mouse;
  });
});
