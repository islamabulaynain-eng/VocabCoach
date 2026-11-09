// ==========================================
// CONFIGURATION & HEADERS (25 COLUMNS WITH PHRASAL VERBS)
// ==========================================
var VOCAB_HEADERS = [
  "ID", "Word", "IPA", "ArabicMeaning", "PartOfSpeech", "Definition",
  "Examples", "Collocations", "Mnemonic", "SimilarWordsJSON",
  "WordFamilyJSON", "ConfusablesJSON", "WordAnatomy", "CommonMisspellings",
  "Proficiency", "ReviewCount", "CorrectCount", "WrongCount", "HintsUsed",
  "NextReviewDate", "FSRS_S", "FSRS_D", "DateAdded", "LastModified", "PhrasalVerbsJSON"
];

var LOG_HEADERS = ["Timestamp", "Word", "Rating", "Correct", "HintsUsed"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var vocabSheet = getOrCreateSheet(ss, "Vocabulary", VOCAB_HEADERS);
    var logSheet = getOrCreateSheet(ss, "SRS_Log", LOG_HEADERS);

    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = JSON.parse(decodeURIComponent(e.postData.contents));
      }
    } else {
      return createJsonResponse({ status: "error", message: "No post data received" });
    }

    var action = body.action;

    // 1. Single Rating Event
    if (action === "logRating") {
      var entry = body.data || {};
      logSheet.appendRow([
        entry.timestamp || new Date().toISOString(),
        entry.word || "",
        entry.rating !== undefined ? entry.rating : "",
        entry.correct !== undefined ? entry.correct : "",
        entry.hints !== undefined ? entry.hints : 0
      ]);
      return createJsonResponse({ status: "success", action: "logRating" });
    }

    // 2. Batch Historical Logs
    if (action === "syncAllLogs" && Array.isArray(body.logs)) {
      if (body.logs.length === 0) return createJsonResponse({ status: "success", count: 0 });
      var logRows = body.logs.map(function(item) {
        return [
          item.timestamp || new Date().toISOString(),
          item.word || "",
          item.rating !== undefined ? item.rating : "",
          item.correct !== undefined ? item.correct : "",
          item.hints !== undefined ? item.hints : 0
        ];
      });
      var nextRow = logSheet.getLastRow() + 1;
      logSheet.getRange(nextRow, 1, logRows.length, LOG_HEADERS.length).setValues(logRows);
      return createJsonResponse({ status: "success", count: logRows.length });
    }

    // 3. Batch Push of Entire Vocabulary
    if (action === "syncAll" && Array.isArray(body.words)) {
      vocabSheet.clearContents();
      vocabSheet.appendRow(VOCAB_HEADERS);
      vocabSheet.getRange(1, 1, 1, VOCAB_HEADERS.length).setFontWeight("bold");

      if (body.words.length > 0) {
        var rows = body.words.map(function(w) {
          return [
            w.id || "",
            w.word || "",
            w.ipa || "",
            w.meaning || "",
            w.pos || "",
            w.definition || "",
            w.examples || "",
            w.collocations || "",
            w.mnemonic || "",
            w.similarWordsJSON || "[]",
            w.wordFamilyJSON || "[]",
            w.confusablesJSON || "[]",
            w.wordAnatomy || "",
            w.commonMisspellings || "",
            w.proficiency !== undefined ? w.proficiency : 0,
            w.reviewCount !== undefined ? w.reviewCount : 0,
            w.correctCount !== undefined ? w.correctCount : 0,
            w.wrongCount !== undefined ? w.wrongCount : 0,
            w.hintsUsed !== undefined ? w.hintsUsed : 0,
            w.nextReview || "",
            w.fsrs_S !== undefined ? w.fsrs_S : "",
            w.fsrs_D !== undefined ? w.fsrs_D : "",
            w.dateAdded || "",
            w.lastModified || new Date().toISOString(),
            w.phrasalVerbsJSON || "[]"
          ];
        });
        vocabSheet.getRange(2, 1, rows.length, VOCAB_HEADERS.length).setValues(rows);
      }
      return createJsonResponse({ status: "success", count: body.words.length });
    }

    // 4. Add or Update Word
    if (action === "add" || action === "update") {
      var w = body.data || {};
      var data = vocabSheet.getDataRange().getValues();
      var rowIndex = -1;

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(w.id) || (w.word && String(data[i][1]).toLowerCase() === String(w.word).toLowerCase())) {
          rowIndex = i + 1;
          break;
        }
      }

      var rowValues = [
        w.id || "",
        w.word || "",
        w.ipa || "",
        w.meaning || "",
        w.pos || "",
        w.definition || "",
        w.examples || "",
        w.collocations || "",
        w.mnemonic || "",
        w.similarWordsJSON || "[]",
        w.wordFamilyJSON || "[]",
        w.confusablesJSON || "[]",
        w.wordAnatomy || "",
        w.commonMisspellings || "",
        w.proficiency !== undefined ? w.proficiency : 0,
        w.reviewCount !== undefined ? w.reviewCount : 0,
        w.correctCount !== undefined ? w.correctCount : 0,
        w.wrongCount !== undefined ? w.wrongCount : 0,
        w.hintsUsed !== undefined ? w.hintsUsed : 0,
        w.nextReview || "",
        w.fsrs_S !== undefined ? w.fsrs_S : "",
        w.fsrs_D !== undefined ? w.fsrs_D : "",
        w.dateAdded || "",
        w.lastModified || new Date().toISOString(),
        w.phrasalVerbsJSON || "[]"
      ];

      if (rowIndex > 0) {
        vocabSheet.getRange(rowIndex, 1, 1, VOCAB_HEADERS.length).setValues([rowValues]);
      } else {
        vocabSheet.appendRow(rowValues);
      }
      return createJsonResponse({ status: "success", action: action, id: w.id });
    }

    // 5. Delete Word from Google Sheets
    if (action === "delete") {
      var targetId = String((body.data && body.data.id) || body.id || "");
      var targetWord = String((body.data && body.data.word) || body.word || "").toLowerCase();
      var data = vocabSheet.getDataRange().getValues();
      var deleted = false;

      for (var i = 1; i < data.length; i++) {
        var rowId = String(data[i][0]);
        var rowWord = String(data[i][1]).toLowerCase();

        if ((targetId && rowId === targetId) || (targetWord && rowWord === targetWord)) {
          vocabSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      return createJsonResponse({ status: "success", action: "delete", deleted: deleted });
    }

    return createJsonResponse({ status: "ignored" });
  } catch (err) {
    return createJsonResponse({ status: "error", error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var vocabSheet = ss.getSheetByName("Vocabulary");
    
    if (!vocabSheet || vocabSheet.getLastRow() < 2) {
      return createJsonResponse({ words: [] });
    }

    var rows = vocabSheet.getDataRange().getValues();
    var words = [];

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[1]) continue;

      words.push({
        id: String(r[0]),
        word: String(r[1]),
        ipa: String(r[2] || ""),
        meaning: String(r[3] || ""),
        pos: String(r[4] || ""),
        definition: String(r[5] || ""),
        examples: r[6] ? String(r[6]).split(' | ') : [],
        collocations: r[7] ? String(r[7]).split(' | ') : [],
        mnemonic: String(r[8] || ""),
        similarWords: safeJsonParse(r[9]),
        wordFamily: safeJsonParse(r[10]),
        confusables: safeJsonParse(r[11]),
        wordAnatomy: String(r[12] || ""),
        commonMisspellings: String(r[13] || ""),
        proficiency: Number(r[14]) || 0,
        reviewCount: Number(r[15]) || 0,
        correctCount: Number(r[16]) || 0,
        wrongCount: Number(r[17]) || 0,
        hintsUsed: Number(r[18]) || 0,
        nextReview: r[19] ? String(r[19]) : "",
        fsrs_S: parseFloat(r[20]) || null,
        fsrs_D: parseFloat(r[21]) || null,
        dateAdded: r[22] ? String(r[22]) : "",
        lastModified: r[23] ? String(r[23]) : "",
        phrasalVerbs: safeJsonParse(r[24]) // Correctly reads phrasal verbs on pull
      });
    }

    return createJsonResponse({ words: words });
  } catch (err) {
    return createJsonResponse({ error: err.toString(), words: [] });
  }
}

function getOrCreateSheet(ss, sheetName, defaultHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(defaultHeaders);
    sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold");
  }
  return sheet;
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str) || [];
  } catch (e) {
    return [];
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
