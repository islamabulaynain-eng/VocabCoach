/* ============================================================
   APPLICATION CORE, ROUTING, BULK IMPORT, IMPORT/EXPORT & INIT
============================================================ */
let darkMode = false;

function toggleDark() {
  darkMode = !darkMode; document.body.classList.toggle('dark', darkMode);
  document.getElementById('darkBtn').textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('vocabCoach_dark', darkMode ? '1' : '0');
}

function loadDarkMode() {
  if (localStorage.getItem('vocabCoach_dark') === '1') {
    darkMode = true; document.body.classList.add('dark');
    if (document.getElementById('darkBtn')) document.getElementById('darkBtn').textContent = '☀️ Light Mode';
  }
}

function showTab(tabName) {
  if (ygTabWidget && typeof ygTabWidget.pause === 'function') {
    try { ygTabWidget.pause(); } catch(e) {}
  }

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  if (document.getElementById('tab-' + tabName)) document.getElementById('tab-' + tabName).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + tabName + "'")) btn.classList.add('active');
  });
  if (tabName === 'dashboard') updateDashboard();
  if (tabName === 'vocabulary') renderVocabList();
  if (tabName === 'settings') loadSettingsUI();
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, duration);
}

function logLine(containerId, message, type = 'info') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  el.appendChild(line); el.scrollTop = el.scrollHeight;
}

function clearLog(containerId) {
  if (document.getElementById(containerId)) document.getElementById(containerId).innerHTML = '';
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function saveStreak() {
  const today = todayStr();
  const data = getStreakData();
  if (data.lastDate === today) return;
  const yesterday = offsetDate(-1);
  data.streak = (data.lastDate === yesterday) ? data.streak + 1 : 1;
  data.lastDate = today;
  localStorage.setItem('vocabCoach_streak', JSON.stringify(data));
}

function getStreakData() {
  try {
    const raw = localStorage.getItem('vocabCoach_streak');
    return raw ? JSON.parse(raw) : { streak: 0, lastDate: '' };
  } catch(e) { return { streak: 0, lastDate: '' }; }
}

function saveActivity(entry) {
  try {
    let log = getActivityLog();
    log.unshift({ ...entry, timestamp: Date.now() });
    if (log.length > 50) log = log.slice(0, 50);
    localStorage.setItem('vocabCoach_activity', JSON.stringify(log));
  } catch(e) {}
}

function getActivityLog() {
  try {
    const raw = localStorage.getItem('vocabCoach_activity');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function updateDashboard() {
  const total = vocab.length;
  const due = vocab.filter(w => isDue(w)).length;
  const mastered = vocab.filter(w => w.proficiency === 3).length;
  const streakData = getStreakData();
  
  let totalCorrect = 0, totalWrong = 0;
  vocab.forEach(w => { totalCorrect += (w.correctCount || 0); totalWrong += (w.wrongCount || 0); });
  const totalAnswered = totalCorrect + totalWrong;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDue').textContent = due;
  document.getElementById('statMastered').textContent = mastered;
  document.getElementById('statStreak').textContent = streakData.streak;
  document.getElementById('statAccuracy').textContent = accuracy + '%';
  
  const levels = [0, 1, 2, 3];
  const labels = ['🆕 New', '📘 Learning', '🔶 Familiar', '✅ Mastered'];
  const colors = ['red', 'orange', '', 'green'];
  const counts = levels.map(l => vocab.filter(w => (w.proficiency || 0) === l).length);
  const barsEl = document.getElementById('proficiencyBars');
  barsEl.innerHTML = '';
  levels.forEach((l, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    barsEl.innerHTML += `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px;">
          <span>${labels[i]}</span><span style="color:var(--text2);">${counts[i]} words (${pct}%)</span>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill ${colors[i]}" style="width:${pct}%"></div></div>
      </div>`;
  });
  
  const weakEl = document.getElementById('weakestWords');
  const weak = vocab.filter(w => (w.reviewCount || 0) > 0).sort((a, b) => (getAccuracy(a) ?? 100) - (getAccuracy(b) ?? 100)).slice(0, 5);
  if (weak.length === 0) {
    weakEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌱</div><div class="empty-state-text">Practice more to identify weak words</div></div>`;
  } else {
    weakEl.innerHTML = weak.map(w => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <div><div style="font-weight:700;color:var(--text);">${escHtml(w.word)}</div><div style="font-size:12px;color:var(--text2);">${escHtml(w.meaning)}</div></div>
        <span class="badge badge-danger">${getAccuracy(w) !== null ? getAccuracy(w) + '%' : 'No data'}</span>
      </div>`).join('');
  }
  
  const actEl = document.getElementById('recentActivity');
  const log = getActivityLog();
  if (log.length === 0) {
    actEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No activity yet. Start practicing!</div></div>`;
  } else {
    actEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">` + log.slice(0, 8).map(entry => `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span>${entry.message}</span><span style="color:var(--text2);white-space:nowrap;margin-left:12px;">${timeAgo(entry.timestamp)}</span>
      </div>`).join('') + `</div>`;
  }
}

function loadSettingsUI() {
  document.getElementById('geminiKeyInput').value = localStorage.getItem('vocabCoach_geminiKey') || '';
  document.getElementById('sheetsUrlInput').value = localStorage.getItem('vocabCoach_sheetsUrl') || '';
  document.getElementById('fsrsRetention').value = fsrsSettings.retention || 90;
  document.getElementById('fsrsMaxInterval').value = fsrsSettings.maxInterval || 36500;
  loadPronunciationSettings();
  document.getElementById('autoPronounceToggle').checked = autoPronounce;
  document.getElementById('pronounceSpeed').value = pronounceSpeed;
}

function toggleKeyVisibility() {
  const input = document.getElementById('geminiKeyInput');
  const btn = document.getElementById('toggleKeyBtn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈 Hide'; }
  else { input.type = 'password'; btn.textContent = '👁️ Show'; }
}
function saveApiKey() {
  const key = document.getElementById('geminiKeyInput').value.trim();
  if (!key) return showToast('Please enter an API key first', 'warning');
  localStorage.setItem('vocabCoach_geminiKey', key);
  showToast('✅ API key saved successfully!', 'success');
}
function clearApiKey() {
  if (!confirm('Remove saved API key?')) return;
  localStorage.removeItem('vocabCoach_geminiKey');
  document.getElementById('geminiKeyInput').value = '';
  showToast('API key removed', 'info');
}

function saveFsrsSettings() {
  fsrsSettings.retention = parseInt(document.getElementById('fsrsRetention').value) || 90;
  fsrsSettings.maxInterval = parseInt(document.getElementById('fsrsMaxInterval').value) || 36500;
  saveFsrsToStorage();
  showToast('✅ FSRS settings saved!', 'success');
}
function resetFsrsSettings() {
  fsrsSettings = { retention: 90, maxInterval: 36500 };
  saveFsrsToStorage(); loadSettingsUI(); showToast('FSRS settings reset', 'info');
}

function exportExcel() {
  if (vocab.length === 0) return showToast('No words to export', 'warning');
  try {
    const wb = XLSX.utils.book_new();
    const vocabData = vocab.map(w => ({
      ID: w.id, Word: w.word, IPA: w.ipa || '', ArabicMeaning: w.meaning, PartOfSpeech: w.pos || '',
      Definition: w.definition || '', Examples: (w.examples || []).join(' | '),
      Collocations: (w.collocations || []).join(' | '), Mnemonic: w.mnemonic || '',
      SimilarWordsJSON: JSON.stringify(w.similarWords || []), 
      WordFamilyJSON: JSON.stringify(w.wordFamily || []),
      ConfusablesJSON: JSON.stringify(w.confusables || []),
      WordAnatomy: w.wordAnatomy || '', CommonMisspellings: w.commonMisspellings || '',
      Proficiency: w.proficiency, ReviewCount: w.reviewCount, CorrectCount: w.correctCount,
      PhrasalVerbsJSON: JSON.stringify(w.phrasalVerbs || []),
      WrongCount: w.wrongCount, HintsUsed: w.hintsUsed || 0, NextReviewDate: w.nextReview,
      FSRS_S: w.fsrs_S || '', FSRS_D: w.fsrs_D || '', 
      DateAdded: w.dateAdded, LastModified: w.lastModified || new Date().toISOString()
    }));
    const wsVocab = XLSX.utils.json_to_sheet(vocabData);
    XLSX.utils.book_append_sheet(wb, wsVocab, "Vocabulary");
    XLSX.writeFile(wb, `vocabcoach_backup_${todayStr()}.xlsx`);
    showToast(`✅ Exported Excel Backup (${vocab.length} words)`, 'success');
  } catch (err) { showToast('Excel export failed: ' + err.message, 'error'); }
}

function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);
      
      if (!json || json.length === 0) throw new Error('Excel sheet is empty');
      let added = 0;
      json.forEach(row => {
        if (!row.Word || !row.ArabicMeaning) return;
        if (!vocab.find(v => v.word.toLowerCase() === row.Word.toLowerCase())) {
          vocab.push(createWord({
            id: row.ID, word: row.Word, ipa: row.IPA, meaning: row.ArabicMeaning, pos: row.PartOfSpeech,
            definition: row.Definition, examples: row.Examples ? String(row.Examples).split(' | ') : [],
            collocations: row.Collocations ? String(row.Collocations).split(' | ') : [],
            mnemonic: row.Mnemonic, 
            similarWords: row.SimilarWordsJSON ? JSON.parse(row.SimilarWordsJSON) : [],
            wordFamily: row.WordFamilyJSON ? JSON.parse(row.WordFamilyJSON) : [],
            confusables: row.ConfusablesJSON ? JSON.parse(row.ConfusablesJSON) : [],
            wordAnatomy: row.WordAnatomy || '', commonMisspellings: row.CommonMisspellings || '',
            proficiency: parseInt(row.Proficiency) || 0, reviewCount: parseInt(row.ReviewCount) || 0,
            phrasalVerbs: row.PhrasalVerbsJSON ? JSON.parse(row.PhrasalVerbsJSON) : [],
            correctCount: parseInt(row.CorrectCount) || 0, wrongCount: parseInt(row.WrongCount) || 0,
            hintsUsed: parseInt(row.HintsUsed) || 0, nextReview: row.NextReviewDate, 
            fsrs_S: parseFloat(row.FSRS_S) || null, fsrs_D: parseFloat(row.FSRS_D) || null,
            dateAdded: row.DateAdded
          }));
          added++;
        }
      });
      saveVocab(); renderVocabList(); updateDashboard();
      showToast(`✅ Imported ${added} words from Excel`, 'success');
    } catch(err) { showToast('Excel import failed: ' + err.message, 'error'); }
    event.target.value = '';
  };
  reader.readArrayBuffer(file);
}

function exportData(format) {
  if (vocab.length === 0) return showToast('No words to export', 'warning');
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(vocab, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vocabcoach_${todayStr()}.json`; a.click(); URL.revokeObjectURL(a.href);
    showToast(`✅ Exported ${vocab.length} words as JSON`, 'success');
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Invalid format');
      const valid = data.filter(w => w.word && w.meaning);
      let added = 0;
      valid.forEach(w => {
        if (!vocab.find(v => v.word.toLowerCase() === w.word.toLowerCase())) {
          vocab.push({ ...createWord(w), ...w }); added++;
        }
      });
      saveVocab(); renderVocabList(); updateDashboard();
      showToast(`✅ Imported ${added} new words`, 'success');
    } catch(err) { showToast('Import failed: ' + err.message, 'error'); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function confirmClearAll() {
  if (!confirm('⚠️ Permanently delete ALL vocabulary data?')) return;
  vocab = []; saveVocab();
  localStorage.removeItem('vocabCoach_activity'); localStorage.removeItem('vocabCoach_streak');
  renderVocabList(); updateDashboard(); showToast('All data cleared', 'warning');
}

// Bulk Import
let bulkQueue = [];
let bulkIndex = 0;
let bulkStats = { added: 0, skipped: 0 };
let isBulkRunning = false;

function startBulkImport() {
  const rawText = document.getElementById('bulkPasteArea').value;
  if (!rawText.trim()) return showToast('Please paste some words first.', 'warning');
  const rawWords = rawText.split(/[\n,;]+/).map(w => w.trim()).filter(w => w.length > 0);
  bulkQueue = [...new Set(rawWords)];
  if (bulkQueue.length === 0) return showToast('No valid words found.', 'warning');
  
  bulkIndex = 0; bulkStats = { added: 0, skipped: 0 }; isBulkRunning = true;
  document.getElementById('bulkInputCard').style.display = 'none';
  document.getElementById('bulkSummaryCard').style.display = 'none';
  document.getElementById('bulkProcessCard').style.display = 'block';
  
  renderBulkQueue(); processNextBulkWord();
}

function renderBulkQueue() {
  const container = document.getElementById('bulkWordQueue');
  container.innerHTML = bulkQueue.map((w, i) => {
    let className = 'bulk-word-tag';
    if (i === bulkIndex) className += ' active';
    else if (i < bulkIndex) className += ' done';
    return `<span class="${className}" id="bulkTag_${i}">${escHtml(w)}</span>`;
  }).join('');
}

async function processNextBulkWord() {
  if (!isBulkRunning) return;
  if (bulkIndex >= bulkQueue.length) return finishBulkImport();
  
  const currentWord = bulkQueue[bulkIndex];
  renderBulkQueue();
  
  document.getElementById('bulkProgressText').textContent = `Word ${bulkIndex + 1} of ${bulkQueue.length}`;
  document.getElementById('bulkProgressBar').style.width = Math.round((bulkIndex / bulkQueue.length) * 100) + '%';
  document.getElementById('bulkCurrentWordDisplay').textContent = currentWord;
  
  const editor = document.getElementById('bulkEditorArea');
  editor.style.opacity = '0.5'; editor.style.pointerEvents = 'none';
  
  clearWordForm();
  ['bWord','bIpa','bMeaning','bDefinition','bExamples','bMnemonic'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
  document.getElementById('bPos').value = '';
  document.getElementById('bWord').value = currentWord;
  
  currentSimilarWords = []; currentWordFamily = []; currentConfusables = []; currentWordAnatomy = ""; currentMisspellings = ""; currentPhrasalVerbs = [];
  
  try { await triggerLookup(currentWord); } 
  catch (err) { showToast(`Lookup failed for "${currentWord}"`, 'error'); }
  
  editor.style.opacity = '1'; editor.style.pointerEvents = 'auto';
  document.getElementById('bMeaning').focus();
}

function confirmBulkWord() {
  if (!isBulkRunning) return;
  const word = document.getElementById('bWord').value.trim();
  const meaning = document.getElementById('bMeaning').value.trim();
  if (!word || !meaning) return showToast('Word and Meaning are required', 'warning');
  
  const wordData = {
    word, ipa: document.getElementById('bIpa').value.trim(), meaning,
    pos: document.getElementById('bPos').value.trim(), definition: document.getElementById('bDefinition').value.trim(),
    examples: document.getElementById('bExamples').value.split('\n').filter(e => e.trim()),
    collocations: [], mnemonic: document.getElementById('bMnemonic').value.trim(),
    similarWords: [...currentSimilarWords], wordFamily: [...currentWordFamily], confusables: [...currentConfusables],
    phrasalVerbs: [...currentPhrasalVerbs],
    wordAnatomy: currentWordAnatomy, commonMisspellings: currentMisspellings, lastModified: new Date().toISOString()
  };
  
  const existingIdx = vocab.findIndex(v => v.word.toLowerCase() === word.toLowerCase());
  if (existingIdx !== -1) { 
    vocab[existingIdx] = { ...vocab[existingIdx], ...wordData }; 
    syncWordToSheets(vocab[existingIdx], 'update'); 
  } else { 
    const newWord = createWord(wordData); 
    vocab.push(newWord); 
    syncWordToSheets(newWord, 'add'); 
  }
  
  saveVocab(); bulkStats.added++;
  const tag = document.getElementById(`bulkTag_${bulkIndex}`);
  if (tag) tag.className = 'bulk-word-tag done';
  bulkIndex++; processNextBulkWord();
}

function skipBulkWord() {
  if (!isBulkRunning) return;
  bulkStats.skipped++;
  const tag = document.getElementById(`bulkTag_${bulkIndex}`);
  if (tag) tag.className = 'bulk-word-tag skipped';
  bulkIndex++; processNextBulkWord();
}

function stopBulkImport() { isBulkRunning = false; finishBulkImport(); }
function finishBulkImport() {
  isBulkRunning = false;
  document.getElementById('bulkProcessCard').style.display = 'none';
  document.getElementById('bulkSummaryCard').style.display = 'block';
  document.getElementById('bulkSummaryText').innerHTML = `<strong>${bulkStats.added}</strong> words saved.<br><strong>${bulkStats.skipped}</strong> skipped.`;
  renderVocabList(); updateDashboard();
}

function resetBulkImport() {
  document.getElementById('bulkPasteArea').value = '';
  document.getElementById('bulkSummaryCard').style.display = 'none';
  document.getElementById('bulkInputCard').style.display = 'block';
}

// Global modal triggers
document.getElementById('wordModal').addEventListener('click', function(e) { if (e.target === this) closeWordModal(); });
document.getElementById('viewModal').addEventListener('click', function(e) { if (e.target === this) closeViewModal(); });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeWordModal(); closeViewModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (document.getElementById('wordModal').classList.contains('open')) saveWord();
  }
});

// App Initialization
(function init() {
  loadVocab();
  loadFsrsFromStorage();
  loadDarkMode();

  sheetsUrl = localStorage.getItem('vocabCoach_sheetsUrl') || '';
  if (sheetsUrl) forceSync(); else setSyncStatus('');
  updateDashboard(); renderVocabList(); showTab('dashboard');
  console.log(`✅ VocabCoach Pro Modular Edition initialized — ${vocab.length} words loaded`);
})();
