// Animal Direction Adventure - remove player-name prompt patch
// This wrapper keeps the original gameTelemetry.js untouched.
import "./gameTelemetry.js";

console.log("[ArrowGame] PLAYER-NAME PROMPT BYPASS v1 loaded");

runOnStartup(async runtime => {
  const MAIN_LAYOUT = "Layout 5 Mainmenu";

  function getFirst(name) {
    try {
      return runtime.objects?.[name]?.getFirstInstance?.() ?? null;
    } catch (_) {
      return null;
    }
  }

  function suppressPlayerNamePrompt() {
    let input = null;
    try {
      input = getFirst("PlayerNameInput");
      if (input) {
        const currentText = String(input.text ?? "").trim();
        let currentUsername = "";
        try {
          currentUsername = String(runtime.globalVars?.Username ?? "").trim();
        } catch (_) {}

        // Keep a real student name if the web system has already supplied one.
        // Otherwise use a harmless non-empty fallback so Construct's old
        // "name is required" condition is satisfied without showing the field.
        const value = currentText || currentUsername || "ผู้เล่น";
        if (!currentText) input.text = value;
        input.isVisible = false;
      }
    } catch (_) {}

    try {
      const warning = getFirst("WarningText");
      if (warning) {
        warning.text = "";
        warning.isVisible = false;
      }
    } catch (_) {}
  }

  runtime.addEventListener("tick", () => {
    try {
      if (runtime.layout?.name === MAIN_LAYOUT) {
        suppressPlayerNamePrompt();
      }
    } catch (_) {}
  });
});
