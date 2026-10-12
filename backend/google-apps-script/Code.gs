/**
 * Learning Game Sheet Backend (Google Apps Script)
 * ใช้กับ Google Sheet หนึ่งไฟล์ โดย Script นี้จะสร้างแท็บที่จำเป็นให้อัตโนมัติ
 */

const SHEET_NAMES = {
  RESULTS: 'GameResults',
  STAGES: 'StageSummary',
  CLICKS: 'ClickEvents',
  USAGE: 'UsageHistory'
};

function doGet() {
  return json_({ ok: true, service: 'learning-game-sheet-backend', now: new Date().toISOString() });
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = String(body.action || '').trim();

    if (action === 'health') {
      return json_({ ok: true, now: new Date().toISOString() });
    }

    if (action === 'saveGameResult') {
      const result = body.result || {};
      if (!result.resultId || !result.studentId || !result.report) {
        return json_({ ok: false, message: 'missing resultId/studentId/report' });
      }

      const saved = saveGameResult_(result);
      return json_({ ok: true, saved: saved });
    }

    return json_({ ok: false, message: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, message: String(err && err.message ? err.message : err) });
  }
}

function parseBody_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  return JSON.parse(text || '{}');
}

function saveGameResult_(result) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = result.report || {};
  const session = report.session || {};

  const resultSheet = ensureSheet_(ss, SHEET_NAMES.RESULTS, [
    'receivedAtIso','resultId','sessionId','launchSessionId','studentId','studentName','gameId','gameTitle',
    'status','finalLevel','score','scorePct','correctClicks','wrongClicks','otherClicks','totalClicks',
    'overallAccuracyPct','upPct','rightPct','downPct','leftPct','avgReactionMs','medianReactionMs',
    'measuredDurationMs','startedAtIso','endedAtIso','character','appVersion'
  ]);

  if (hasValueInColumn_(resultSheet, 2, String(result.resultId))) {
    return { duplicate: true, resultId: result.resultId };
  }

  resultSheet.appendRow([
    new Date().toISOString(),
    value_(result.resultId),
    value_(result.sessionId || session.sessionId),
    value_(result.launchSessionId),
    value_(result.studentId),
    value_(result.studentName),
    value_(result.gameId),
    value_(result.gameTitle),
    value_(session.status),
    number_(session.finalLevel),
    number_(session.score),
    number_(session.scorePct),
    number_(session.correctClicks),
    number_(session.wrongClicks),
    number_(session.otherClicks),
    number_(session.totalClicks),
    number_(session.overallAccuracyPct),
    number_(session.upPct),
    number_(session.rightPct),
    number_(session.downPct),
    number_(session.leftPct),
    number_(session.avgReactionMs),
    number_(session.medianReactionMs),
    number_(session.measuredDurationMs),
    value_(session.startedAtIso),
    value_(session.endedAtIso),
    value_(session.character),
    value_(session.appVersion)
  ]);

  const stageSheet = ensureSheet_(ss, SHEET_NAMES.STAGES, [
    'resultId','sessionId','studentId','studentName','gameId','gameTitle','level','status','startedAtIso','endedAtIso',
    'durationMs','sequenceLength','scoreStart','scoreEnd','scoreGained','correctClicks','wrongClicks','otherClicks','totalClicks',
    'accuracyPct','scorePct','avgReactionMs',
    'upPresented','upAttempted','upCorrect','upWrong','upPct',
    'rightPresented','rightAttempted','rightCorrect','rightWrong','rightPct',
    'downPresented','downAttempted','downCorrect','downWrong','downPct',
    'leftPresented','leftAttempted','leftCorrect','leftWrong','leftPct'
  ]);

  const stages = Array.isArray(report.stages) ? report.stages : (Array.isArray(session.stages) ? session.stages : []);
  if (stages.length) {
    const rows = stages.map(stage => {
      const ds = stage.directionStats || {};
      return [
        result.resultId, session.sessionId || result.sessionId, result.studentId, result.studentName, result.gameId, result.gameTitle,
        number_(stage.level), value_(stage.status), value_(stage.startedAtIso), value_(stage.endedAtIso), number_(stage.durationMs),
        number_(stage.sequenceLength), number_(stage.scoreStart), number_(stage.scoreEnd), number_(stage.scoreGained),
        number_(stage.correctClicks), number_(stage.wrongClicks), number_(stage.otherClicks), number_(stage.totalClicks),
        number_(stage.accuracyPct), number_(stage.scorePct), number_(stage.avgReactionMs),
        stat_(ds,'up','presented'), stat_(ds,'up','attempted'), stat_(ds,'up','correct'), stat_(ds,'up','wrong'), stat_(ds,'up','pct'),
        stat_(ds,'right','presented'), stat_(ds,'right','attempted'), stat_(ds,'right','correct'), stat_(ds,'right','wrong'), stat_(ds,'right','pct'),
        stat_(ds,'down','presented'), stat_(ds,'down','attempted'), stat_(ds,'down','correct'), stat_(ds,'down','wrong'), stat_(ds,'down','pct'),
        stat_(ds,'left','presented'), stat_(ds,'left','attempted'), stat_(ds,'left','correct'), stat_(ds,'left','wrong'), stat_(ds,'left','pct')
      ];
    });
    appendRows_(stageSheet, rows);
  }

  const clickSheet = ensureSheet_(ss, SHEET_NAMES.CLICKS, [
    'resultId','sessionId','studentId','studentName','gameId','gameTitle','level','clickNo','trialIndex','timestampIso',
    'elapsedSessionMs','elapsedStageMs','responseTimeMs','sincePreviousClickMs','result','targetDirection','clickedDirection',
    'x','y','scoreAfter','correctClicksAfter','wrongClicksAfter','otherClicksAfter','totalClicksAfter','currentIndexAfter'
  ]);

  const clicks = Array.isArray(report.clicks) ? report.clicks : (Array.isArray(session.clicks) ? session.clicks : []);
  if (clicks.length) {
    const rows = clicks.map(click => [
      result.resultId, session.sessionId || result.sessionId, result.studentId, result.studentName, result.gameId, result.gameTitle,
      number_(click.level), number_(click.clickNo), number_(click.trialIndex), value_(click.timestampIso),
      number_(click.elapsedSessionMs), number_(click.elapsedStageMs), number_(click.responseTimeMs), number_(click.sincePreviousClickMs),
      value_(click.result), value_(click.targetDirection), value_(click.clickedDirection), number_(click.x), number_(click.y),
      number_(click.scoreAfter), number_(click.correctClicksAfter), number_(click.wrongClicksAfter), number_(click.otherClicksAfter),
      number_(click.totalClicksAfter), number_(click.currentIndexAfter)
    ]);
    appendRows_(clickSheet, rows);
  }

  const usageSheet = ensureSheet_(ss, SHEET_NAMES.USAGE, [
    'resultId','sessionId','launchSessionId','studentId','studentName','gameId','gameTitle','startedAtIso','endedAtIso','durationMs','source'
  ]);
  usageSheet.appendRow([
    result.resultId, session.sessionId || result.sessionId, result.launchSessionId || '', result.studentId, result.studentName,
    result.gameId, result.gameTitle, session.startedAtIso || '', session.endedAtIso || '', number_(session.measuredDurationMs), 'telemetry-auto'
  ]);

  return {
    duplicate: false,
    resultId: result.resultId,
    stages: stages.length,
    clicks: clicks.length
  };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function appendRows_(sheet, rows) {
  if (!rows || !rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function hasValueInColumn_(sheet, column, text) {
  if (!text || sheet.getLastRow() < 2) return false;
  const range = sheet.getRange(2, column, sheet.getLastRow() - 1, 1);
  return range.createTextFinder(text).matchEntireCell(true).findNext() !== null;
}

function stat_(stats, dir, key) {
  return number_((stats[dir] || {})[key]);
}

function value_(v) {
  return v === null || v === undefined ? '' : String(v);
}

function number_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
