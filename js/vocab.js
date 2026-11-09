/* ============================================================
   VOCABULARY MANAGEMENT, MODALS, EDITING & BULK ACTIONS
============================================================ */
let vocab = [];
let currentCollocations = [];
let currentSimilarWords = []; 
let currentWordFamily = [];
let currentConfusables = [];
let currentWordAnatomy = "";
let currentMisspellings = "";
let currentPhrasalVerbs = [];

let editingWordId = null;
let viewingWordId = null;
let selectedWordIds = new Set();

function saveVocab() {
  try { 
    localStorage.setItem('vocabCoach_words', JSON.stringify(vocab)); 
  } catch(e) { showToast('Storage error: ' + e.message, 'error'); }
}

function loadVocab() {
  try {
    const raw = localStorage.getItem('vocabCoach_words');
    vocab = raw ? JSON.parse(raw) : [];
  } catch(e) { vocab = []; }
}

function createWord(data) {
  return {
    id: data.id || (Date.now().toString() + Math.random().toString(36).slice(2, 7)),
    word: (data.word || '').trim(),
    ipa: (data.ipa || '').trim(),
    meaning: (data.meaning || '').trim(),
    pos: (data.pos || '').trim(),
    definition: (data.definition || '').trim(),
    examples: (data.examples || []).filter(e => e.trim()),
    collocations: (data.collocations || []),
    mnemonic: (data.mnemonic || '').trim(),
    
    similarWords: (data.similarWords || []), 
    wordFamily: (data.wordFamily || []),
    confusables: (data.confusables || []),
    wordAnatomy: (data.wordAnatomy || '').trim(),
    commonMisspellings: (data.commonMisspellings || '').trim(),
    phrasalVerbs: (data.phrasalVerbs || []),
    
    dateAdded: data.dateAdded || todayStr(),
    nextReview: data.nextReview || todayStr(),
    proficiency: data.proficiency || 0,
    reviewCount: data.reviewCount || 0,
    correctCount: data.correctCount || 0,
    wrongCount: data.wrongCount || 0,
    hintsUsed: data.hintsUsed || 0,
    lastRating: data.lastRating || null,
    history: data.history || [],
    fsrs_S: data.fsrs_S || null, 
    fsrs_D: data.fsrs_D || null, 
    lastReviewDate: data.lastReviewDate || null,
    lastModified: new Date().toISOString()
  };
}

function renderVocabList() {
  const search = (document.getElementById('vocabSearch').value || '').toLowerCase().trim();
  const filter = document.getElementById('vocabFilter').value;
  const sort   = document.getElementById('vocabSort').value;
  
  let list = [...vocab];
  
  if (filter === 'due')      list = list.filter(w => isDue(w));
  if (filter === 'mastered') list = list.filter(w => w.proficiency === 3);
  if (filter === 'learning') list = list.filter(w => w.proficiency === 1 || w.proficiency === 2);
  if (filter === 'new')      list = list.filter(w => (w.proficiency || 0) === 0);
  
  if (search) {
    list = list.filter(w => w.word.toLowerCase().includes(search));
    list.forEach(w => {
      const idx = w.word.toLowerCase().indexOf(search);
      w._searchScore = idx === 0 ? 0 : idx; 
    });
    list.sort((a, b) => a._searchScore - b._searchScore || a.word.localeCompare(b.word));
  } else {
    if (sort === 'newest') list.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    if (sort === 'oldest') list.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
    if (sort === 'az')     list.sort((a, b) => a.word.localeCompare(b.word));
    if (sort === 'za')     list.sort((a, b) => b.word.localeCompare(a.word));
    if (sort === 'due')    list.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
    if (sort === 'weak')   list.sort((a, b) => (getAccuracy(a) ?? 101) - (getAccuracy(b) ?? 101));
  }
  
  const container = document.getElementById('vocabList');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${search ? '🔍' : '📭'}</div><div class="empty-state-title">${search ? 'No results found' : 'No words yet'}</div><div class="empty-state-text">${search ? 'Try a different search term' : 'Click "Add Word" to start building your vocabulary!'}</div></div>`;
    return;
  }
  
  container.innerHTML = list.map(w => {
    const due = isDue(w); const daysLeft = daysUntilReview(w); const acc = getAccuracy(w);
    const profBadge = getProficiencyBadge(w.proficiency); const profLabel = getProficiencyLabel(w.proficiency);
    const dueBadge = due ? `<span class="badge badge-danger">🔥 Due</span>` : `<span class="badge badge-info">📅 ${daysLeft}d</span>`;
    const isChecked = selectedWordIds.has(w.id) ? 'checked' : '';
    const spellingWarning = w.commonMisspellings ? `<span class="spelling-warning" title="${escHtml(w.commonMisspellings)}">⚠️ Spelling</span>` : '';

    return `
      <div class="word-item" id="wordItem_${w.id}">
        <input type="checkbox" class="word-item-checkbox" data-id="${w.id}" ${isChecked} onchange="toggleWordSelection('${w.id}', this.checked)">
        <div class="word-item-left">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="word-item-word">
              ${escHtml(w.word)}
              <button class="btn-pronounce" onclick="pronounceWord('${escHtml(w.word).replace(/'/g, "\\'")}')" title="Pronounce">🔊</button>
            </span>
            ${w.ipa ? `<span style="font-size:13px; color:var(--text2);">${escHtml(w.ipa)}</span>` : ''}
            <span class="badge ${profBadge}">${profLabel}</span>
            ${dueBadge}
            ${spellingWarning}
          </div>
          <div class="word-item-meta">
            ${w.meaning ? `<span style="margin-right:12px;">🇸🇦 ${escHtml(w.meaning)}</span>` : ''}
            ${w.pos ? `<span style="margin-right:12px; text-transform:capitalize;">📝 ${escHtml(w.pos)}</span>` : ''}
            ${acc !== null ? `<span>🎯 ${acc}% accuracy</span>` : ''}
          </div>
        </div>
        <div class="word-item-actions">
          <button class="btn btn-ghost btn-icon" onclick="viewWord('${w.id}')" title="View Details">👁️</button>
          <button class="btn btn-ghost btn-icon" onclick="reviewOneWord('${w.id}')" title="Quick Flash Review">⚡</button>
          <button class="btn btn-ghost btn-icon" onclick="practiceOneWord('${w.id}')" title="Quick Typing Practice">🧠</button>
          <button class="btn btn-ghost btn-icon" onclick="openEditWordModal('${w.id}')" title="Edit">✏️</button>
        </div>
      </div>`;
  }).join('');
}

function viewWord(id) {
  const w = vocab.find(v => v.id === id);
  if (!w) return;
  viewingWordId = id;
  const acc = getAccuracy(w);
  const profBadge = getProficiencyBadge(w.proficiency);
  const profLabel = getProficiencyLabel(w.proficiency);
  const due = isDue(w);
  
  let html = `
    <div style="margin-bottom:20px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:36px; font-weight:900; color:var(--primary); font-family:'Courier New',monospace; letter-spacing:-1px;">${escHtml(w.word)}</div>
            <button class="btn-pronounce" style="font-size:24px;" onclick="pronounceWord('${escHtml(w.word).replace(/'/g, "\\'")}')" title="Pronounce">🔊</button>
          </div>
          ${w.ipa ? `<div style="font-size:16px; color:var(--text2); margin-top:4px;">${escHtml(w.ipa)}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
          <span class="badge ${profBadge}">${profLabel}</span>
          <span class="badge ${due?'badge-danger':'badge-info'}">${due ? '🔥 Due Now' : '📅 Next: ' + formatDate(w.nextReview)}</span>
        </div>
      </div>
    </div>
    <hr class="divider"/>`;

  if (w.meaning) html += `<div style="margin-bottom:14px;"><div class="form-label" style="margin-bottom:4px;">🇸🇦 Arabic Meaning</div><div style="font-size:20px; font-weight:800; color:var(--text); direction:rtl; text-align:right;">${escHtml(w.meaning)}</div></div>`;
  if (w.pos) html += `<div style="margin-bottom:14px;"><div class="form-label" style="margin-bottom:4px;">📝 Part of Speech</div><div style="text-transform:capitalize; font-weight:600;">${escHtml(w.pos)}</div></div>`;
  if (w.definition) html += `<div style="margin-bottom:14px;"><div class="form-label" style="margin-bottom:4px;">📖 English Definition</div><div style="color:var(--text); line-height:1.6; font-size:15px;">${escHtml(w.definition)}</div></div>`;
  
  if (w.wordAnatomy) {
    html += `
      <div class="lexical-section">
        <div class="lexical-header">🧩 Word Anatomy (Roots & Affixes)</div>
        <div style="font-family:monospace; color:var(--primary); font-size:15px; font-weight:700;">${escHtml(w.wordAnatomy)}</div>
      </div>`;
  }

  if (w.examples && w.examples.length > 0) {
    html += `<div style="margin-bottom:20px;"><div class="form-label" style="margin-bottom:6px;">💬 Example Sentences</div>${w.examples.map(ex => `<div style="background:var(--surface2); border-left:4px solid var(--primary); padding:12px 16px; border-radius:0 var(--radius-sm) var(--radius-sm) 0; margin-bottom:8px; font-style:italic; color:var(--text); line-height:1.5;">"${escHtml(ex)}"</div>`).join('')}</div>`;
  }
  
  if (w.collocations && w.collocations.length > 0) {
    html += `<div style="margin-bottom:20px;"><div class="form-label" style="margin-bottom:6px;">🔗 Collocations</div><div class="tag-list">${w.collocations.map(c => `<span class="tag">${escHtml(c)}</span>`).join('')}</div></div>`;
  }

  if (w.wordFamily && Array.isArray(w.wordFamily) && w.wordFamily.length > 0) {
    html += `
      <div class="lexical-section">
        <div class="lexical-header">🌳 Word Family (Derivations)</div>
        <table class="compare-table table-info" style="table-layout: fixed;">
          <thead><tr><th style="width:15%;">POS</th><th style="width:35%;">Word</th><th style="width:50%;">Arabic Meaning</th></tr></thead>
          <tbody>
            ${w.wordFamily.filter(f => f && typeof f === 'object' && f.word).map(f => `
              <tr>
                <td style="font-weight:700; color:var(--text2); text-transform:capitalize; word-wrap:break-word;">${escHtml(f.pos)}</td>
                <td style="font-weight:700; color:var(--primary); word-wrap:break-word;">${escHtml(f.word)}</td>
                <td style="direction:rtl; text-align:right; word-wrap:break-word;">${escHtml(f.meaning)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (w.phrasalVerbs && Array.isArray(w.phrasalVerbs) && w.phrasalVerbs.length > 0) {
    html += `
      <div class="lexical-section">
        <div class="lexical-header">🔗 Phrasal Verbs & Expressions</div>
        <table class="compare-table table-info" style="table-layout: fixed;">
          <thead><tr><th style="width:30%;">Phrase</th><th style="width:30%;">Meaning</th><th style="width:40%;">Example</th></tr></thead>
          <tbody>
            ${w.phrasalVerbs.map(pv => `
              <tr>
                <td style="font-weight:700; color:var(--primary); word-wrap:break-word;">${escHtml(pv.phrase)}</td>
                <td style="direction:rtl; text-align:right; word-wrap:break-word;">${escHtml(pv.meaning)}</td>
                <td style="font-style:italic; font-size:13px; line-height:1.4; word-wrap:break-word;">"${escHtml(pv.example)}"</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (w.similarWords && Array.isArray(w.similarWords) && w.similarWords.length > 0) {
    html += `
      <div class="lexical-section">
        <div class="lexical-header">🔄 Similar Words & Usage</div>
        <table class="compare-table" style="table-layout: fixed;">
          <thead><tr><th style="width:25%;">Word</th><th style="width:25%;">Meaning</th><th style="width:50%;">Usage Difference</th></tr></thead>
          <tbody>
            ${w.similarWords.filter(sim => sim && typeof sim === 'object' && sim.word).map(sim => `
              <tr>
                <td style="font-weight:700; color:var(--primary); word-wrap:break-word;">${escHtml(sim.word)}</td>
                <td style="direction:rtl; text-align:right; word-wrap:break-word;">${escHtml(sim.meaning)}</td>
                <td style="line-height:1.4; word-wrap:break-word;">${escHtml(sim.usage_difference)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (w.confusables && Array.isArray(w.confusables) && w.confusables.length > 0) {
    html += `
      <div class="lexical-section" style="border-color:var(--danger-light); background:var(--danger-light);">
        <div class="lexical-header" style="color:var(--danger);">⚠️ Watch Out! (Commonly Confused Words)</div>
        <table class="compare-table table-danger" style="table-layout: fixed;">
          <thead><tr><th style="width:25%;">Confused With</th><th style="width:25%;">Its Meaning</th><th style="width:50%;">Why it's confused</th></tr></thead>
          <tbody>
            ${w.confusables.filter(c => c && typeof c === 'object' && c.word).map(c => `
              <tr>
                <td style="font-weight:800; color:var(--danger); word-wrap:break-word;">${escHtml(c.word)}</td>
                <td style="direction:rtl; text-align:right; word-wrap:break-word;">${escHtml(c.meaning)}</td>
                <td style="line-height:1.4; word-wrap:break-word;">${escHtml(c.reason)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (w.mnemonic) html += `<div style="margin-bottom:14px;"><div class="form-label" style="margin-bottom:4px;">🧠 Memory Tip</div><div style="background:var(--warning-light); border:1.5px solid var(--warning); border-radius:var(--radius-sm); padding:16px; color:var(--warning); font-weight:600; line-height:1.6;">💡 ${escHtml(w.mnemonic)}</div></div>`;
  
  if (w.commonMisspellings) {
    html += `<div style="margin-bottom:14px; background:var(--danger-light); color:var(--danger); padding:12px; border-radius:var(--radius-sm); border:1px dashed var(--danger); font-size:13px; font-weight:700;">⚠️ Commonly misspelled as: ${escHtml(w.commonMisspellings)}</div>`;
  }

  html += `
    <hr class="divider"/>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px,1fr)); gap:12px;">
      <div style="text-align:center; background:var(--surface2); border-radius:var(--radius-sm); padding:12px; border:1px solid var(--border);"><div style="font-size:22px; font-weight:800; color:var(--primary);">${w.reviewCount || 0}</div><div style="font-size:12px; color:var(--text2); font-weight:600;">Reviews</div></div>
      <div style="text-align:center; background:var(--surface2); border-radius:var(--radius-sm); padding:12px; border:1px solid var(--border);"><div style="font-size:22px; font-weight:800; color:var(--success);">${w.correctCount || 0}</div><div style="font-size:12px; color:var(--text2); font-weight:600;">Correct</div></div>
      <div style="text-align:center; background:var(--surface2); border-radius:var(--radius-sm); padding:12px; border:1px solid var(--border);"><div style="font-size:22px; font-weight:800; color:var(--danger);">${w.wrongCount || 0}</div><div style="font-size:12px; color:var(--text2); font-weight:600;">Wrong</div></div>
      <div style="text-align:center; background:var(--surface2); border-radius:var(--radius-sm); padding:12px; border:1px solid var(--border);"><div style="font-size:22px; font-weight:800; color:var(--warning);">${acc !== null ? acc + '%' : '—'}</div><div style="font-size:12px; color:var(--text2); font-weight:600;">Accuracy</div></div>
    </div>
    <div style="margin-top:16px; font-size:12px; color:var(--text2); text-align:right;">Added: ${formatDate(w.dateAdded)}</div>`;
    
  document.getElementById('viewModalContent').innerHTML = html;
  document.getElementById('viewModal').classList.add('open');
}

function closeViewModal() { document.getElementById('viewModal').classList.remove('open'); viewingWordId = null; }
function editFromView() { closeViewModal(); if (viewingWordId) openEditWordModal(viewingWordId); }

function openAddWordModal() {
  editingWordId = null; 
  currentCollocations = []; 
  currentSimilarWords = []; 
  currentWordFamily = []; 
  currentConfusables = []; 
  currentPhrasalVerbs = []; 
  currentWordAnatomy = ""; 
  currentMisspellings = "";
  document.getElementById('wordModalTitle').textContent = '➕ Add New Word';
  document.getElementById('mPronounceBtn').style.display = 'none';
  clearWordForm();
  document.getElementById('mPhrasalGroup').style.display = 'none';
  document.getElementById('wordModal').classList.add('open');
  document.getElementById('lookupStatus').style.display = 'none';
  setTimeout(() => document.getElementById('mWord').focus(), 100);
}

function openEditWordModal(id) {
  const w = vocab.find(v => v.id === id);
  if (!w) return;
  editingWordId = id; 
  currentCollocations = [...(w.collocations || [])];
  currentSimilarWords = Array.isArray(w.similarWords) ? [...w.similarWords] : [];
  currentWordFamily = Array.isArray(w.wordFamily) ? [...w.wordFamily] : [];
  currentConfusables = Array.isArray(w.confusables) ? [...w.confusables] : [];
  currentPhrasalVerbs = Array.isArray(w.phrasalVerbs) ? [...w.phrasalVerbs] : []; 
  currentWordAnatomy = w.wordAnatomy || "";
  currentMisspellings = w.commonMisspellings || "";
  
  document.getElementById('wordModalTitle').textContent = '✏️ Edit Word';
  document.getElementById('mPronounceBtn').style.display = 'inline-flex';
  
  document.getElementById('mWord').value = w.word || '';
  document.getElementById('mIpa').value = w.ipa || '';
  document.getElementById('mMeaning').value = w.meaning || '';
  document.getElementById('mPos').value = w.pos || '';
  document.getElementById('mDefinition').value = w.definition || '';
  document.getElementById('mExamples').value = (w.examples || []).join('\n');
  document.getElementById('mMnemonic').value = w.mnemonic || '';
  renderCollocTags();
  
  const phrasalGroup = document.getElementById('mPhrasalGroup');
  const phrasalPreview = document.getElementById('mPhrasalPreview');
  if (phrasalGroup && phrasalPreview) {
    if (currentPhrasalVerbs.length > 0) {
      phrasalGroup.style.display = 'block';
      phrasalPreview.innerHTML = currentPhrasalVerbs.map(pv => 
        `<div style="margin-bottom:4px;">• <strong style="color:var(--primary);">${escHtml(pv.phrase)}</strong>: ${escHtml(pv.meaning)} <em style="color:var(--text2); font-size:11px;">("${escHtml(pv.example)}")</em></div>`
      ).join('');
    } else {
      phrasalGroup.style.display = 'none';
    }
  }

  document.getElementById('lookupStatus').style.display = 'none';
  document.getElementById('wordModal').classList.add('open');
}

function closeWordModal() { 
  document.getElementById('wordModal').classList.remove('open'); 
  editingWordId = null; 
  currentCollocations = []; 
  currentSimilarWords = []; 
  currentWordFamily = []; 
  currentConfusables = []; 
  currentPhrasalVerbs = [];
}

function clearWordForm() {
  ['mWord','mIpa','mMeaning','mDefinition','mExamples','mMnemonic','mCollocInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('mPos').value = '';
  renderCollocTags();
}

function addCollocation(event) {
  if (event.key !== 'Enter' && event.type !== 'click') return;
  const input = document.getElementById('mCollocInput');
  const val = input.value.trim();
  if (!val) return;
  if (currentCollocations.includes(val)) { showToast('Collocation already added', 'warning'); input.value = ''; return; }
  currentCollocations.push(val); input.value = ''; renderCollocTags();
}

function removeCollocation(index) { currentCollocations.splice(index, 1); renderCollocTags(); }
function renderCollocTags() {
  const container = document.getElementById('mCollocTags');
  if (!container) return;
  container.innerHTML = currentCollocations.map((c, i) => `<span class="tag">${escHtml(c)} <span class="tag-remove" onclick="removeCollocation(${i})">×</span></span>`).join('');
}

let wordInputTimer = null;
function onWordInput(value) {
  if (value.trim().length > 0) document.getElementById('mPronounceBtn').style.display = 'inline-flex';
  else document.getElementById('mPronounceBtn').style.display = 'none';
}

function saveWord() {
  const word = document.getElementById('mWord').value.trim();
  const meaning = document.getElementById('mMeaning').value.trim();
  if (!word) return (showToast('⚠️ Please enter a word', 'warning'), document.getElementById('mWord').focus());
  if (!meaning) return (showToast('⚠️ Please enter the Arabic meaning', 'warning'), document.getElementById('mMeaning').focus());
  
  const examples = document.getElementById('mExamples').value.split('\n').map(e => e.trim()).filter(e => e.length > 0);
  const wordData = {
    word, ipa: document.getElementById('mIpa').value.trim(), meaning,
    pos: document.getElementById('mPos').value.trim(), definition: document.getElementById('mDefinition').value.trim(),
    examples, collocations: [...currentCollocations], mnemonic: document.getElementById('mMnemonic').value.trim(),
    similarWords: [...currentSimilarWords], wordFamily: [...currentWordFamily], confusables: [...currentConfusables],
    phrasalVerbs: Array.isArray(currentPhrasalVerbs) ? [...currentPhrasalVerbs] : [],
    wordAnatomy: currentWordAnatomy, commonMisspellings: currentMisspellings,
    lastModified: new Date().toISOString()
  };
  
  const existingIdx = vocab.findIndex(v => (editingWordId && v.id === editingWordId) || v.word.toLowerCase() === word.toLowerCase());
  
  if (existingIdx !== -1) {
    vocab[existingIdx] = { ...vocab[existingIdx], ...wordData };
    showToast(`✅ "${word}" updated!`, 'success');
    syncWordToSheets(vocab[existingIdx], 'update');
  } else {
    const newWord = createWord(wordData);
    vocab.push(newWord);
    showToast(`✅ "${word}" added!`, 'success');
    syncWordToSheets(newWord, 'add');
  }
  
  saveVocab(); 
  closeWordModal(); 
  renderVocabList(); 
  updateDashboard();
}

async function deleteWord(id) {
  const w = vocab.find(v => v.id === id);
  if (!w) return;
  if (!confirm(`Delete "${w.word}" from your library?`)) return;
  
  const wordName = w.word;
  const wordId = w.id;

  vocab = vocab.filter(v => v.id !== id);
  saveVocab(); 
  renderVocabList(); 
  updateDashboard();
  showToast(`🗑️ "${wordName}" deleted locally`, 'info');

  if (sheetsUrl) {
    setSyncStatus('syncing');
    try {
      await fetch(sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: wordId,
          word: wordName
        })
      });
      setTimeout(() => setSyncStatus('synced'), 1000);
      showToast(`✅ "${wordName}" deleted from Google Sheets!`, 'success');
    } catch(err) {
      setSyncStatus('failed');
    }
  }
  saveActivity({ message: `🗑️ Deleted word: "${wordName}"` });
}

function practiceOneWord(id) {
  const w = vocab.find(v => v.id === id);
  if (!w) return;
  practiceSession = { words: [w], index: 0, score: 0, hintsUsed: 0, correct: 0, wrong: 0, mode: 'active' };
  showTab('practice');
  document.getElementById('practiceSetupCard').style.display = 'none';
  document.getElementById('practiceCompleteCard').style.display = 'none';
  document.getElementById('flashReviewCard').style.display = 'none';
  document.getElementById('practiceSessionCard').style.display = 'block';
  loadPracticeWord();
}

function reviewOneWord(id) {
  const w = vocab.find(v => v.id === id);
  if (!w) return;
  practiceSession = { words: [w], index: 0, score: 0, hintsUsed: 0, correct: 0, wrong: 0, mode: 'flash' };
  showTab('practice');
  document.getElementById('practiceSetupCard').style.display = 'none';
  document.getElementById('practiceCompleteCard').style.display = 'none';
  document.getElementById('practiceSessionCard').style.display = 'none';
  document.getElementById('flashReviewCard').style.display = 'block';
  loadPracticeWord();
}

function toggleSelectAll(isChecked) {
  const checkboxes = document.querySelectorAll('.word-item-checkbox:not(#selectAllCheckbox)');
  selectedWordIds.clear();
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) selectedWordIds.add(cb.dataset.id);
  });
  updateBulkActionBar();
}

function toggleWordSelection(id, isChecked) {
  if (isChecked) selectedWordIds.add(id);
  else selectedWordIds.delete(id);
  
  const allFiltered = document.querySelectorAll('.word-item-checkbox:not(#selectAllCheckbox)');
  document.getElementById('selectAllCheckbox').checked = (selectedWordIds.size === allFiltered.length && allFiltered.length > 0);
  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  const countSpan = document.getElementById('bulkSelectedCount');
  countSpan.textContent = selectedWordIds.size;
  
  if (selectedWordIds.size > 0) {
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
    document.getElementById('selectAllCheckbox').checked = false;
  }
}

function clearBulkSelection() {
  selectedWordIds.clear();
  document.querySelectorAll('.word-item-checkbox').forEach(cb => cb.checked = false);
  updateBulkActionBar();
}

function bulkDeleteWords() {
  if (!confirm(`Are you sure you want to delete ${selectedWordIds.size} words?`)) return;
  const ids = Array.from(selectedWordIds);
  ids.forEach(id => deleteWord(id));
  clearBulkSelection();
}

async function bulkReLookupAI() {
  if (!confirm(`Re-run AI lookup for ${selectedWordIds.size} words?`)) return;
  const idsToProcess = Array.from(selectedWordIds);
  clearBulkSelection();
  
  let successCount = 0;
  showToast('🤖 Bulk AI Lookup started...', 'info');
  
  for (let id of idsToProcess) {
    const wIdx = vocab.findIndex(v => v.id === id);
    if (wIdx === -1) continue;
    
    try {
      const prompt = buildLookupPrompt(vocab[wIdx].word);
      const { text } = await callGemini(localStorage.getItem('vocabCoach_geminiKey') || '', prompt, null);
      const res = JSON.parse(text);
      
      vocab[wIdx].ipa = res.ipa || vocab[wIdx].ipa;
      vocab[wIdx].meaning = res.meaning || vocab[wIdx].meaning;
      vocab[wIdx].pos = res.pos || vocab[wIdx].pos;
      vocab[wIdx].definition = res.definition || vocab[wIdx].definition;
      vocab[wIdx].examples = (res.examples && res.examples.length > 0) ? res.examples : vocab[wIdx].examples;
      vocab[wIdx].collocations = (res.collocations && res.collocations.length > 0) ? res.collocations : vocab[wIdx].collocations;
      vocab[wIdx].mnemonic = res.mnemonic || vocab[wIdx].mnemonic;
      vocab[wIdx].similarWords = res.similarWords || vocab[wIdx].similarWords;
      vocab[wIdx].wordFamily = res.wordFamily || vocab[wIdx].wordFamily;
      vocab[wIdx].confusables = res.confusables || vocab[wIdx].confusables;
      vocab[wIdx].wordAnatomy = res.wordAnatomy || vocab[wIdx].wordAnatomy;
      vocab[wIdx].commonMisspellings = res.commonMisspellings || vocab[wIdx].commonMisspellings;
      vocab[wIdx].phrasalVerbs = res.phrasalVerbs || vocab[wIdx].phrasalVerbs;
      vocab[wIdx].lastModified = new Date().toISOString();
      
      syncWordToSheets(vocab[wIdx], 'update');
      successCount++;
    } catch (e) {
      console.error("Bulk AI fail for", vocab[wIdx].word, e);
    }
  }
  
  saveVocab();
  renderVocabList();
  showToast(`✅ Bulk AI update complete (${successCount}/${idsToProcess.length} succeeded)`, 'success');
}
