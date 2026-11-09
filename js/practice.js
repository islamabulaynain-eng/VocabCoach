/* ============================================================
   ACTIVE RECALL (TYPING) & FLASH REVIEW SESSION LOGIC
============================================================ */
let practiceSession = { words: [], index: 0, score: 0, hintsUsed: 0, correct: 0, wrong: 0, mode: 'active' };

function startPractice(mode = 'active') {
  const type  = document.getElementById('practiceType').value;
  const count = document.getElementById('practiceCount').value;
  let pool = [];
  
  if (type === 'due')  pool = vocab.filter(w => isDue(w));
  if (type === 'all')  pool = [...vocab];
  if (type === 'new')  pool = vocab.filter(w => (w.proficiency || 0) === 0);
  if (type === 'weak') {
    pool = vocab.filter(w => (w.reviewCount || 0) > 0).sort((a, b) => (getAccuracy(a) ?? 101) - (getAccuracy(b) ?? 101));
    if (pool.length === 0) pool = [...vocab];
  }
  
  if (pool.length === 0) return showToast('⚠️ No words available for this session type.', 'warning');
  pool = shuffleArray(pool);
  if (count !== 'all') pool = pool.slice(0, Math.min(parseInt(count), pool.length));
  
  practiceSession = { words: pool, index: 0, score: 0, hintsUsed: 0, correct: 0, wrong: 0, startTime: Date.now(), mode: mode };
  
  document.getElementById('practiceSetupCard').style.display = 'none';
  document.getElementById('practiceCompleteCard').style.display = 'none';
  
  if (mode === 'flash') {
    document.getElementById('practiceSessionCard').style.display = 'none';
    document.getElementById('flashReviewCard').style.display = 'block';
  } else {
    document.getElementById('flashReviewCard').style.display = 'none';
    document.getElementById('practiceSessionCard').style.display = 'block';
  }
  
  loadPracticeWord(); 
  saveStreak();
}

function loadPracticeWord() {
  const session = practiceSession;
  const word = session.words[session.index];
  if (!word) return;
  
  const total = session.words.length;
  const current = session.index + 1;
  
  if (session.mode === 'flash') {
    document.getElementById('flashProgress').textContent = `Word ${current} of ${total}`;
    document.getElementById('flashProgressBar').style.width = Math.round(((current - 1) / total) * 100) + '%';
    document.getElementById('flashCardInner').classList.remove('flipped');
    document.getElementById('flashWord').textContent = word.word;
    document.getElementById('flashIpa').textContent = word.ipa || '';
    document.getElementById('flashRatingButtons').style.display = 'none';
    
    let backHtml = `
      <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:12px;" onclick="event.stopPropagation()">
        <span style="font-size:26px; font-weight:800; color:var(--primary);">${escHtml(word.meaning)}</span>
        <button class="btn-pronounce" onclick="pronounceWord('${escHtml(word.word).replace(/'/g, "\\'")}')" title="Pronounce">🔊</button>
      </div>`;
    
    if (word.definition) {
      backHtml += `<div style="font-size:14px; color:var(--text); line-height:1.5; margin-bottom:14px; text-align:center;">${escHtml(word.definition)}</div>`;
    }

    if (word.examples && word.examples.length > 0) {
      backHtml += `
        <div style="width:100%; margin-bottom:14px; text-align:left;" onclick="event.stopPropagation()">
          <div style="font-size:12px; font-weight:700; color:var(--text2); text-transform:uppercase; margin-bottom:6px;">💬 Example Sentences:</div>
          ${word.examples.map(ex => `
            <div style="background:var(--surface); border-left:3px solid var(--primary); padding:8px 12px; border-radius:0 var(--radius-sm) var(--radius-sm) 0; margin-bottom:6px; font-style:italic; font-size:13px; line-height:1.4;">
              "${escHtml(ex)}"
            </div>
          `).join('')}
        </div>`;
    }

    if (word.collocations && word.collocations.length > 0) {
      backHtml += `
        <div style="width:100%; margin-bottom:14px; text-align:left;" onclick="event.stopPropagation()">
          <div style="font-size:12px; font-weight:700; color:var(--text2); text-transform:uppercase; margin-bottom:4px;">🔗 Collocations:</div>
          <div class="tag-list" style="margin-top:2px;">
            ${word.collocations.map(c => `<span class="tag" style="font-size:12px; padding:3px 10px;">${escHtml(c)}</span>`).join('')}
          </div>
        </div>`;
    }

    backHtml += `
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin: 10px 0; justify-content:center;" onclick="event.stopPropagation()">
        ${word.wordAnatomy ? `<button class="btn btn-ghost btn-sm" onclick="toggleFlashInline('anatomy')">🧩 Anatomy</button>` : ''}
        ${(word.wordFamily && word.wordFamily.length > 0) ? `<button class="btn btn-ghost btn-sm" onclick="toggleFlashInline('family')">🌳 Word Family</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="toggleFlashInline('phrasal')">🔗 Phrasal Verbs ${word.phrasalVerbs && word.phrasalVerbs.length ? `(${word.phrasalVerbs.length})` : ''}</button>
        ${(word.confusables && word.confusables.length > 0) ? `<button class="btn btn-ghost btn-sm" onclick="toggleFlashInline('confusables')">⚠️ Watch Out</button>` : ''}
        ${(word.similarWords && word.similarWords.length > 0) ? `<button class="btn btn-ghost btn-sm" onclick="toggleFlashInline('similar')">🔄 Similar Words</button>` : ''}
        ${word.mnemonic ? `<button class="btn btn-ghost btn-sm" onclick="toggleFlashInline('mnemonic')">🧠 Memory Tip</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="searchWordInYouglishFromPractice()">🎬 Video Context</button>
      </div>
      <div id="flashInlineContainer" class="inline-deep-dive" onclick="event.stopPropagation()"></div>`;
    document.getElementById('flashBackContent').innerHTML = backHtml;
  }
  else {
    document.getElementById('practiceProgress').textContent = `Word ${current} of ${total}`;
    document.getElementById('practiceProgressBar').style.width = Math.round(((current - 1) / total) * 100) + '%';
    document.getElementById('practiceSessionScore').textContent = `Score: ${session.score}`;
    
    const visualEl = document.getElementById('practiceVisual');
    if (document.getElementById('enableVisuals').checked) {
      visualEl.style.display = 'block';
      visualEl.src = 'https://image.pollinations.ai/prompt/' + encodeURIComponent('concept image of ' + word.word) + '?width=800&height=300&nologo=true';
    } else { visualEl.style.display = 'none'; }
    
    const meaningEl = document.getElementById('practiceMeaning');
    const clozeEl = document.getElementById('practiceCloze');
    const promptLabel = document.getElementById('practicePromptLabel');
    
    const useCloze = document.getElementById('enableCloze').checked && word.examples && word.examples.length > 0 && Math.random() > 0.5;
    if (useCloze) {
      const ex = word.examples[Math.floor(Math.random() * word.examples.length)];
      const clozeStr = ex.replace(new RegExp(word.word, 'gi'), '<span class="cloze-blank">______</span>');
      meaningEl.style.display = 'none'; clozeEl.style.display = 'block';
      clozeEl.innerHTML = clozeStr; promptLabel.textContent = "Fill in the blank:";
    } else {
      meaningEl.style.display = 'block'; clozeEl.style.display = 'none';
      meaningEl.textContent = word.meaning || '(no meaning set)'; promptLabel.textContent = "What word means:";
    }
    
    document.getElementById('practicePos').textContent = ''; 
    document.getElementById('practiceHintDisplay').textContent = '';
    
    const input = document.getElementById('practiceInput');
    input.value = ''; input.disabled = false; input.style.borderColor = ''; input.style.background = '';
    
    document.getElementById('preRevealHints').style.display = 'flex';
    document.getElementById('postRevealDeepDiveBtns').style.display = 'none';
    document.getElementById('practiceInlineContainer').style.display = 'none';
    
    document.getElementById('answerFeedback').style.display = 'none';
    document.getElementById('ratingButtons').style.display = 'none';
    document.getElementById('checkBtn').style.display = 'block';
    document.getElementById('checkBtn').disabled = false;
    setTimeout(() => input.focus(), 100);
  }
}

function flipFlashCard() {
  const card = document.getElementById('flashCardInner');
  if (!card.classList.contains('flipped')) {
    card.classList.add('flipped');
    document.getElementById('flashRatingButtons').style.display = 'flex';
    if (autoPronounce) pronounceWord(practiceSession.words[practiceSession.index].word);
  }
}

function toggleFlashInline(type) {
  const word = practiceSession.words[practiceSession.index];
  const container = document.getElementById('flashInlineContainer');
  if (!container || !word) return;

  if (container.style.display === 'block' && container.dataset.activeType === type) {
    container.style.display = 'none';
    container.dataset.activeType = '';
    return;
  }

  let html = '';
  if (type === 'anatomy' && word.wordAnatomy) {
    html = `<div style="font-size:13px;"><strong>🧩 Morphology / Anatomy:</strong> <span style="font-family:monospace; color:var(--primary);">${escHtml(word.wordAnatomy)}</span></div>`;
  } else if (type === 'family' && word.wordFamily && word.wordFamily.length > 0) {
    html = `
      <div style="font-size:12px; font-weight:700; color:var(--text2); margin-bottom:6px;">🌳 WORD FAMILY:</div>
      <table class="compare-table table-info" style="font-size:12px;">
        <thead><tr><th>POS</th><th>Word</th><th>Meaning</th></tr></thead>
        <tbody>
          ${word.wordFamily.map(f => `
            <tr>
              <td>${escHtml(f.pos)}</td>
              <td style="color:var(--primary); font-weight:700;">${escHtml(f.word)}</td>
              <td style="direction:rtl; text-align:right;">${escHtml(f.meaning)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } else if (type === 'confusables' && word.confusables && word.confusables.length > 0) {
    html = `
      <div style="font-size:12px; font-weight:700; color:var(--danger); margin-bottom:6px;">⚠️ COMMONLY CONFUSED WITH:</div>
      <table class="compare-table table-danger" style="font-size:12px;">
        <thead><tr><th>Word</th><th>Meaning</th><th>Nuance</th></tr></thead>
        <tbody>
          ${word.confusables.map(c => `
            <tr>
              <td style="color:var(--danger); font-weight:800;">${escHtml(c.word)}</td>
              <td style="direction:rtl; text-align:right;">${escHtml(c.meaning)}</td>
              <td>${escHtml(c.reason)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } else if (type === 'similar' && word.similarWords && word.similarWords.length > 0) {
    html = `
      <div style="font-size:12px; font-weight:700; color:var(--text2); margin-bottom:6px;">🔄 SIMILAR WORDS & USAGE NUANCES:</div>
      <table class="compare-table" style="font-size:12px;">
        <thead><tr><th>Word</th><th>Meaning</th><th>Usage Difference</th></tr></thead>
        <tbody>
          ${word.similarWords.map(sim => `
            <tr>
              <td style="color:var(--primary); font-weight:700;">${escHtml(sim.word)}</td>
              <td style="direction:rtl; text-align:right;">${escHtml(sim.meaning)}</td>
              <td>${escHtml(sim.usage_difference)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } else if (type === 'phrasal') {
    if (word.phrasalVerbs && word.phrasalVerbs.length > 0) {
      html = `
        <div style="font-size:12px; font-weight:700; color:var(--primary); margin-bottom:6px;">🔗 PHRASAL VERBS & COMBINATIONS:</div>
        <table class="compare-table table-info" style="font-size:12px; width:100%;">
          <thead><tr><th style="width:30%;">Phrase</th><th style="width:30%;">Meaning</th><th style="width:40%;">Example</th></tr></thead>
          <tbody>
            ${word.phrasalVerbs.map(pv => `
              <tr>
                <td style="color:var(--primary); font-weight:800;">${escHtml(pv.phrase)}</td>
                <td style="direction:rtl; text-align:right;">${escHtml(pv.meaning)}</td>
                <td style="font-style:italic; font-size:11px; line-height:1.4;">"${escHtml(pv.example)}"</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } else {
      html = `<div style="padding:10px; color:var(--text2); font-size:13px; text-align:center;">ℹ️ No phrasal verbs recorded for this word. Re-run AI lookup to generate them.</div>`;
    }
  } else if (type === 'mnemonic' && word.mnemonic) {
    html = `<div style="font-size:13px; color:var(--warning); font-weight:600;">🧠 <strong>Memory Hook:</strong> ${escHtml(word.mnemonic)}</div>`;
  }

  if (html) {
    container.innerHTML = html;
    container.style.display = 'block';
    container.dataset.activeType = type;
  }
}

function togglePracticeInline(type) {
  const word = practiceSession.words[practiceSession.index];
  const container = document.getElementById('practiceInlineContainer');
  if (!container || !word) return;

  if (container.style.display === 'block' && container.dataset.activeType === type) {
    container.style.display = 'none';
    container.dataset.activeType = '';
    return;
  }

  let html = '';
  if (type === 'anatomy' && word.wordAnatomy) {
    html = `<strong>🧩 Anatomy:</strong> <span style="font-family:monospace;">${escHtml(word.wordAnatomy)}</span>`;
  } else if (type === 'family' && word.wordFamily && word.wordFamily.length > 0) {
    html = `<strong>🌳 Word Family:</strong><br>` + word.wordFamily.map(f => `${escHtml(f.pos)}: <strong>${escHtml(f.word)}</strong> (${escHtml(f.meaning)})`).join('<br>');
  } else if (type === 'confusables' && word.confusables && word.confusables.length > 0) {
    html = `<strong style="color:var(--danger);">⚠️ Watch Out:</strong> Confused with <strong>${escHtml(word.confusables[0].word)}</strong> (${escHtml(word.confusables[0].meaning)}).<br><em>${escHtml(word.confusables[0].reason)}</em>`;
  } else if (type === 'similar' && word.similarWords && word.similarWords.length > 0) {
    html = `<strong>🔄 Similar Words:</strong><br>` + word.similarWords.map(s => `<strong>${escHtml(s.word)}</strong> (${escHtml(s.meaning)}): ${escHtml(s.usage_difference)}`).join('<br>');
  } else if (type === 'phrasal') {
    if (word.phrasalVerbs && word.phrasalVerbs.length > 0) {
      html = `<strong>🔗 Phrasal Verbs & Expressions:</strong><br>` + word.phrasalVerbs.map(pv => `• <strong>${escHtml(pv.phrase)}</strong>: ${escHtml(pv.meaning)} <em style="color:var(--text2); font-size:12px;">("${escHtml(pv.example)}")</em>`).join('<br>');
    } else {
      html = `<strong>🔗 Phrasal Verbs:</strong><br><span style="color:var(--text2); font-size:13px;">No phrasal verbs recorded for this word. Re-run AI lookup to generate them.</span>`;
    }
  }

  if (html) {
    container.innerHTML = html;
    container.style.display = 'block';
    container.dataset.activeType = type;
  }
}

function showHint(type) {
  const word = practiceSession.words[practiceSession.index];
  if (!word) return;
  practiceSession.hintsUsed++;
  const v = vocab.find(v => v.id === word.id);
  if (v) v.hintsUsed = (v.hintsUsed || 0) + 1;
  const hintEl = document.getElementById('practiceHintDisplay');
  
  if (type === 'pronounce') { pronounceWord(word.word); hintEl.textContent = '🔊 Playing pronunciation...'; }
  else if (type === 'first') hintEl.textContent = `🔤 First letter: "${word.word[0].toUpperCase()}"`;
  else if (type === 'syllables') hintEl.textContent = word.ipa ? `🔊 IPA chunks: ${word.ipa.replace(/[ˈˌ]/g, ' · ').trim()}` : `🔊 Rough syllables: ${word.word.replace(/([aeiou]+)/gi, '$1·').replace(/·$/, '')}`;
  else if (type === 'pos') { document.getElementById('practicePos').textContent = word.pos ? `[ ${word.pos} ]` : ''; hintEl.textContent = word.pos ? `📝 Part of Speech: ${word.pos}` : '📝 No Part of Speech available'; }
  else if (type === 'definition') hintEl.textContent = word.definition ? `📖 Definition: ${word.definition}` : '📖 No definition available';
  else if (type === 'example') {
    if (!word.examples || word.examples.length === 0) return hintEl.textContent = '💡 No example sentences available';
    const ex = word.examples[Math.floor(Math.random() * word.examples.length)];
    const blanked = ex.replace(new RegExp(word.word, 'gi'), '_'.repeat(word.word.length));
    hintEl.innerHTML = `💡 <em>${blanked}</em>`;
  }
  else if (type === 'mnemonic') hintEl.textContent = word.mnemonic ? `🧠 Mnemonic: ${word.mnemonic}` : '🧠 No mnemonic available';
}

function revealAnswer() {
  const word = practiceSession.words[practiceSession.index];
  const input = document.getElementById('practiceInput');
  input.value = word.word; 
  input.disabled = true;
  input.style.borderColor = 'var(--warning)'; 
  input.style.background = 'var(--warning-light)';
  document.getElementById('practiceHintDisplay').textContent = `👁️ Answer revealed: "${word.word}"`;
  showAnswerFeedback(false, word, true);
  if (autoPronounce) pronounceWord(word.word);
}

function checkAnswer() {
  const word = practiceSession.words[practiceSession.index];
  const input = document.getElementById('practiceInput');
  const userAns = input.value.trim().toLowerCase();
  const correct = word.word.toLowerCase();
  
  if (!userAns) return (showToast('Please type your answer first', 'warning'), input.focus());
  
  const isCorrect = userAns === correct || levenshtein(userAns, correct) <= Math.floor(correct.length * 0.15);
  input.disabled = true;
  
  if (isCorrect) {
    input.style.borderColor = 'var(--success)'; input.style.background = 'var(--success-light)';
    practiceSession.score += 10; practiceSession.correct++;
    document.getElementById('practiceSessionScore').textContent = `Score: ${practiceSession.score}`;
  } else {
    input.style.borderColor = 'var(--danger)'; input.style.background = 'var(--danger-light)';
    practiceSession.wrong++;
  }
  
  showAnswerFeedback(isCorrect, word, false);
  if (autoPronounce) pronounceWord(word.word);
}

function showAnswerFeedback(isCorrect, word, revealed) {
  const feedbackEl = document.getElementById('answerFeedback');
  const btn = document.getElementById('checkBtn');
  
  let headerHtml = revealed ? `<div style="font-size:18px; font-weight:800; color:var(--warning);">👁️ Answer Revealed</div>` 
    : (isCorrect ? `<div style="font-size:18px; font-weight:800; color:var(--success);">✅ Correct! +10 points</div>` 
    : `<div style="font-size:18px; font-weight:800; color:var(--danger);">❌ Not quite! Correct answer:</div>`);
  
  const styleClass = revealed ? 'warning' : (isCorrect ? 'success' : 'danger');
  
  let html = `
    <div style="background:var(--${styleClass}-light); border:1.5px solid var(--${styleClass}); border-radius:var(--radius); padding:16px;">
      ${headerHtml}
      <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:8px;">
        <div style="font-size:28px; font-weight:900; color:var(--text); font-family:'Courier New',monospace;">${escHtml(word.word)}</div>
        <button class="btn-pronounce" onclick="pronounceWord('${escHtml(word.word).replace(/'/g, "\\'")}')" title="Pronounce">🔊</button>
      </div>
      ${word.ipa ? `<div style="color:var(--text2); margin-bottom:6px;">${escHtml(word.ipa)}</div>` : ''}
    </div>`;
    
  if (!isCorrect && !revealed && word.confusables && word.confusables.length > 0) {
    html += `<div style="margin-top:12px; background:var(--danger-light); color:var(--danger); border:1px solid var(--danger); padding:12px; border-radius:var(--radius-sm); text-align:left; font-size:13px;">
      <strong>⚠️ Did you confuse it with ${escHtml(word.confusables[0].word)}?</strong><br>
      That means <em>${escHtml(word.confusables[0].meaning)}</em>. ${escHtml(word.confusables[0].reason)}
    </div>`;
  }
  
  feedbackEl.innerHTML = html;
  feedbackEl.style.display = 'block';
  btn.style.display = 'none';
  
  document.getElementById('preRevealHints').style.display = 'none';
  document.getElementById('postRevealDeepDiveBtns').style.display = 'flex';
  document.getElementById('ratingButtons').style.display = 'flex';
}

function rateWord(rating) {
  const word = practiceSession.words[practiceSession.index];
  const v = vocab.find(v => v.id === word.id);
  if (v) { 
    applyFSRS(v, rating); 
    saveVocab(); 
    syncWordToSheets(v, 'update');
  }
  saveActivity({ message: `🧠 Practiced "${word.word}" — rated ${['Forgot','Hard','Good','Easy'][rating-1]}` });
  practiceSession.index++;
  if (practiceSession.index >= practiceSession.words.length) endPracticeSession();
  else loadPracticeWord();
}

function rateFlashWord(rating, event) {
  event.stopPropagation(); 
  rateWord(rating); 
}

function endPracticeSession() {
  const session = practiceSession;
  const accuracy = session.words.length > 0 ? Math.round((session.correct / session.words.length) * 100) : 0;
  
  document.getElementById('practiceSessionCard').style.display = 'none';
  document.getElementById('flashReviewCard').style.display = 'none';
  document.getElementById('practiceCompleteCard').style.display = 'block';
  
  document.getElementById('sessionSummary').innerHTML = session.mode === 'active' ? `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:14px; margin:20px 0;">
      <div style="background:var(--surface2); padding:16px; border-radius:var(--radius); border:1px solid var(--border);"><div style="font-size:28px; font-weight:800; color:var(--primary);">${session.score}</div><div style="font-size:12px; color:var(--text2);">Score</div></div>
      <div style="background:var(--success-light); padding:16px; border-radius:var(--radius); border:1px solid var(--success);"><div style="font-size:28px; font-weight:800; color:var(--success);">${session.correct}</div><div style="font-size:12px; color:var(--text2);">Correct</div></div>
      <div style="background:var(--danger-light); padding:16px; border-radius:var(--radius); border:1px solid var(--danger);"><div style="font-size:28px; font-weight:800; color:var(--danger);">${session.wrong}</div><div style="font-size:12px; color:var(--text2);">Wrong</div></div>
      <div style="background:var(--info-light); padding:16px; border-radius:var(--radius); border:1px solid var(--info);"><div style="font-size:28px; font-weight:800; color:var(--info);">${accuracy}%</div><div style="font-size:12px; color:var(--text2);">Accuracy</div></div>
    </div>` : `<p style="font-size:18px; margin: 20px 0;">Reviewed ${session.index} words.</p>`;
  
  saveActivity({ message: `🎯 Completed ${session.mode} session: ${session.index} words reviewed.` });
  updateDashboard();
}

function shuffleArray(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function levenshtein(a, b) {
  const m = a.length, n = b.length; const dp = Array.from({length: m+1}, (_, i) => Array.from({length: n+1}, (_, j) => i===0 ? j : j===0 ? i : 0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}
