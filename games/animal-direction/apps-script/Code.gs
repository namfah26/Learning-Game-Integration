const TABLES = {
  Sessions: [
    'sessionId','playerName','username','character','startedAtIso','endedAtIso','status','finalLevel','score',
    'correctClicks','wrongClicks','otherClicks','totalClicks','gameTotalTimeSec','measuredDurationMs',
    'overallAccuracyPct','scorePct','upPct','downPct','leftPct','rightPct','avgReactionMs','medianReactionMs',
    'stagesCompleted','appVersion'
  ],
  StageSummary: [
    'sessionId','playerName','character','level','status','startedAtIso','endedAtIso','durationMs','sequenceLength',
    'scoreStart','scoreEnd','scoreGained','correctClicks','wrongClicks','otherClicks','totalClicks','accuracyPct','scorePct','avgReactionMs',
    'upPresented','upCorrect','upWrong','upPct','downPresented','downCorrect','downWrong','downPct',
    'leftPresented','leftCorrect','leftWrong','leftPct','rightPresented','rightCorrect','rightWrong','rightPct'
  ],
  ClickEvents: [
    'sessionId','playerName','level','clickNo','trialIndex','timestampIso','elapsedSessionMs','elapsedStageMs',
    'responseTimeMs','sincePreviousClickMs','result','targetDirection','clickedDirection','x','y','scoreAfter',
    'correctTotal','wrongTotal','otherTotal','currentIndexAfter'
  ]
};

function doGet() {
  return json_({ ok: true, service: 'Arrow Game Telemetry' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.type !== 'game_session_bundle') throw new Error('Unsupported payload type');

    appendObjects_('Sessions', body.sessions || []);
    appendObjects_('StageSummary', body.stageSummary || []);
    appendObjects_('ClickEvents', body.clickEvents || []);

    return json_({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function appendObjects_(sheetName, rows) {
  if (!rows || !rows.length) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = TABLES[sheetName];
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  const values = rows.map(obj => headers.map(h => normalize_(obj[h])));
  sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function normalize_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
