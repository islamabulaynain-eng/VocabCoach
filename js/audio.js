/* ============================================================
   SPEECH SYNTHESIS & YOUGLISH VIDEO LOGIC
============================================================ */
let autoPronounce = false;
let pronounceSpeed = 0.85;
let ygTabWidget = null;

function loadPronunciationSettings() {
  const savedAuto = localStorage.getItem('vocabCoach_autoPronounce');
  if (savedAuto !== null) autoPronounce = savedAuto === 'true';
  const savedSpeed = localStorage.getItem('vocabCoach_pronounceSpeed');
  if (savedSpeed) pronounceSpeed = parseFloat(savedSpeed);
}

function pronounceWord(text) {
  if (!text || !window.speechSynthesis) return;
  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = pronounceSpeed || 0.85;
  utter.pitch = 1.0;
  utter.volume = 1.0;

  const voices = speechSynthesis.getVoices();
  const engVoice = voices.find(v => v.lang.startsWith('en') && v.localService) || 
                   voices.find(v => v.lang.startsWith('en'));
  if (engVoice) utter.voice = engVoice;

  speechSynthesis.speak(utter);
}

function toggleAutoPronounce() {
  autoPronounce = document.getElementById('autoPronounceToggle').checked;
  localStorage.setItem('vocabCoach_autoPronounce', autoPronounce);
  showToast(autoPronounce ? 'Auto-pronounce enabled' : 'Auto-pronounce disabled', 'info');
}

function savePronounceSpeed() {
  pronounceSpeed = parseFloat(document.getElementById('pronounceSpeed').value);
  localStorage.setItem('vocabCoach_pronounceSpeed', pronounceSpeed);
  pronounceWord("Testing voice speed.");
}

function pronounceModalWord() {
  const word = document.getElementById('mWord').value;
  if (word) pronounceWord(word);
}

function onYouglishAPIReady() {
  try {
    ygTabWidget = new YG.Widget("youglish-tab-widget", {
      width: 640,
      components: 72,
      events: {
        'onFetchDone': onYGTabFetchDone
      }
    });
  } catch(e) {
    console.warn("YouGlish API initialization deferred", e);
  }
}

function onYGTabFetchDone(e) {
  if (e.totalResult === 0) {
    showToast("No video pronunciation found for this query", "warning");
  }
}

function searchYouglishTab() {
  const word = document.getElementById('youglishSearchInput').value.trim();
  const accent = document.getElementById('youglishAccentSelect').value;
  if (!word) return showToast('Please enter a word to search', 'warning');
  
  if (ygTabWidget && typeof ygTabWidget.fetch === 'function') {
    ygTabWidget.fetch(word, "english", accent);
  } else {
    showToast("YouGlish player initializing...", "info");
  }
}

function searchWordInYouglishFromPractice() {
  const word = practiceSession.words[practiceSession.index];
  if (!word) return;
  showTab('youglish');
  document.getElementById('youglishSearchInput').value = word.word;
  setTimeout(() => searchYouglishTab(), 300);
}
