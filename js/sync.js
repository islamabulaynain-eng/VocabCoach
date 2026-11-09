/* ============================================================
   GOOGLE SHEETS SYNC & ROBUST BIDIRECTIONAL DATA FLOW
============================================================ */
let sheetsUrl = '';

function setSyncStatus(status) {
  const indicator = document.getElementById('syncIndicator');
  if (!indicator) return;
  if (!sheetsUrl) { indicator.style.display = 'none'; return; }
  indicator.style.display = 'inline-flex'; 
  indicator.className = `sync-indicator ${status}`;
  
  if (status === 'synced') indicator.innerHTML = '🟢 Synced';
  else if (status === 'syncing') indicator.innerHTML = '🔄 Syncing...';
  else if (status === 'failed') indicator.innerHTML = '🔴 Sync Failed — Retry';
}

function saveSheetsUrl() {
  const url = document.getElementById('sheetsUrlInput').value.trim();
  if (!url) return showToast('Please enter a valid URL', 'warning');
  localStorage.setItem('vocabCoach_sheetsUrl', url);
  sheetsUrl = url; 
  showToast('Google Sheets URL saved! Pulling data...', 'info'); 
  forceSync(true);
}

function clearSheetsUrl() {
  localStorage.removeItem('vocabCoach_sheetsUrl'); 
  sheetsUrl = ''; 
  setSyncStatus('');
  document.getElementById('sheetsUrlInput').value = ''; 
  showToast('Google Sheets disconnected', 'info');
}

function formatWordForSheets(w) {
  return {
    id: w.id || '',
    word: w.word || '',
    ipa: w.ipa || '',
    meaning: w.meaning || '',
    pos: w.pos || '',
    definition: w.definition || '',
    examples: (w.examples || []).join(' | '),
    collocations: (w.collocations || []).join(' | '),
    mnemonic: w.mnemonic || '',
    similarWordsJSON: JSON.stringify(w.similarWords || []),
    wordFamilyJSON: JSON.stringify(w.wordFamily || []),
    confusablesJSON: JSON.stringify(w.confusables || []),
    wordAnatomy: w.wordAnatomy || '',
    commonMisspellings: w.commonMisspellings || '',
    phrasalVerbsJSON: JSON.stringify(w.phrasalVerbs || []),
    proficiency: Number(w.proficiency) || 0,
    reviewCount: Number(w.reviewCount) || 0,
    correctCount: Number(w.correctCount) || 0,
    wrongCount: Number(w.wrongCount) || 0,
    hintsUsed: Number(w.hintsUsed) || 0,
    nextReview: w.nextReview || todayStr(),
    fsrs_S: w.fsrs_S || '',
    fsrs_D: w.fsrs_D || '',
    dateAdded: w.dateAdded || todayStr(),
    lastModified: w.lastModified || new Date().toISOString()
  };
}

async function syncWordToSheets(wordData, actionType) {
  if (!sheetsUrl) return;
  setSyncStatus('syncing');
  try {
    const payload = {
      action: actionType || 'update',
      target: 'vocabulary',
      data: formatWordForSheets(wordData),
      id: wordData.id,
      word: wordData.word
    };
    await fetch(sheetsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setTimeout(() => setSyncStatus('synced'), 800);
  } catch (err) {
    setSyncStatus('failed');
  }
}

async function syncAllVocabToSheets(showNotifications = false) {
  if (!sheetsUrl) {
    if (showNotifications) showToast('Please configure a Google Sheets URL first', 'warning');
    return;
  }
  if (vocab.length === 0) {
    if (showNotifications) showToast('No local words to sync', 'info');
    return;
  }

  setSyncStatus('syncing');
  if (showNotifications) showToast(`Uploading all ${vocab.length} words to Google Sheets...`, 'info');

  try {
    const payload = {
      action: 'syncAll',
      target: 'vocabulary',
      words: vocab.map(formatWordForSheets)
    };

    await fetch(sheetsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setSyncStatus('synced');
    if (showNotifications) {
      showToast(`✅ Successfully pushed ${vocab.length} words to the Vocabulary sheet!`, 'success');
    }
  } catch (err) {
    setSyncStatus('failed');
    if (showNotifications) {
      showToast('❌ Sync failed. Check network connection or Script URL.', 'error');
    }
  }
}

async function syncAllLogsToSheets(showNotifications = false) {
  if (!sheetsUrl) {
    if (showNotifications) showToast('Please configure a Google Sheets URL first', 'warning');
    return;
  }

  const allLogs = [];
  vocab.forEach(w => {
    if (Array.isArray(w.history) && w.history.length > 0) {
      w.history.forEach(h => {
        allLogs.push({
          timestamp: h.date || w.dateAdded || todayStr(),
          word: w.word,
          rating: h.rating,
          correct: Number(h.rating) >= 3,
          hints: w.hintsUsed || 0
        });
      });
    }
  });

  if (allLogs.length === 0) {
    if (showNotifications) showToast('No historical rating logs found locally', 'info');
    return;
  }

  setSyncStatus('syncing');
  if (showNotifications) showToast(`Uploading ${allLogs.length} historical logs...`, 'info');

  try {
    const payload = {
      action: 'syncAllLogs',
      target: 'srs_log',
      logs: allLogs
    };

    await fetch(sheetsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setSyncStatus('synced');
    if (showNotifications) {
      showToast(`✅ Successfully pushed ${allLogs.length} historical logs to SRS_Log!`, 'success');
    }
  } catch (err) {
    setSyncStatus('failed');
    if (showNotifications) {
      showToast('❌ Failed to upload logs. Check network connection.', 'error');
    }
  }
}

async function forceSync(notify = false) {
  if (!sheetsUrl) return;
  setSyncStatus('syncing');
  try {
    const res = await fetch(sheetsUrl + '?action=getAllWords');
    if (res.ok) {
      const data = await res.json();
      if (data && data.words && Array.isArray(data.words)) {
        if (vocab.length === 0) {
          vocab = data.words.map(remoteWord => createWord(remoteWord));
        } else {
          data.words.forEach(remoteWord => {
            const localIdx = vocab.findIndex(v => v.id === remoteWord.id || v.word.toLowerCase() === remoteWord.word.toLowerCase());
            if (localIdx === -1) {
              vocab.push(createWord(remoteWord));
            } else {
              const localTime = new Date(vocab[localIdx].lastModified || 0).getTime();
              const remoteTime = new Date(remoteWord.lastModified || 0).getTime();
              if (remoteTime >= localTime) {
                vocab[localIdx] = { ...vocab[localIdx], ...createWord(remoteWord) };
              }
            }
          });
        }

        saveVocab();
        renderVocabList();
        updateDashboard();
        if (notify) showToast(`✅ Synced ${vocab.length} words successfully!`, 'success');
      }
    }
    setSyncStatus('synced');
  } catch (err) {
    setSyncStatus('failed');
    if (notify) showToast('❌ Sync check failed. Check network.', 'error');
  }
}

async function logRatingToSheets(wordData, rating) {
  if (!sheetsUrl) return;
  try { 
    await fetch(sheetsUrl, { 
      method: 'POST', 
      mode: 'no-cors', 
      body: JSON.stringify({ 
        action: 'logRating', 
        data: { 
          word: wordData.word, 
          rating: rating, 
          correct: rating >= 3, 
          hints: wordData.hintsUsed || 0 
        } 
      }) 
    }); 
  } catch(e) {}
}
