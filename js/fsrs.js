/* ============================================================
   FSRS v4 REPETITION SCHEDULER & DATE UTILITIES
============================================================ */
let fsrsSettings = { retention: 90, maxInterval: 36500 };

function todayStr() { return new Date().toISOString().split('T')[0]; }
function offsetDate(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0];
}
function addDays(dateStr, days) {
  const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0];
}
function isDue(word) { return word.nextReview <= todayStr(); }
function daysUntilReview(word) {
  const today = new Date(todayStr());
  const next = new Date(word.nextReview);
  return Math.ceil((next - today) / 86400000);
}
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function saveFsrsToStorage() { localStorage.setItem('vocabCoach_fsrs', JSON.stringify(fsrsSettings)); }
function loadFsrsFromStorage() {
  try {
    const raw = localStorage.getItem('vocabCoach_fsrs');
    if (raw) fsrsSettings = { ...fsrsSettings, ...JSON.parse(raw) };
  } catch(e) {}
}

function applyFSRS(word, rating) {
  const w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
  
  let S = word.fsrs_S || 0;
  let D = word.fsrs_D || 0;
  let daysSinceLast = word.lastReviewDate ? Math.max(Math.ceil((new Date() - new Date(word.lastReviewDate)) / 86400000), 1) : 1;
  
  if (!word.fsrs_S) {
    S = w[rating - 1];
    D = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  } else {
    let R = Math.exp(Math.log(0.9) * (daysSinceLast / S));
    D = Math.min(Math.max(D + w[6] * (rating - 3), 1), 10);
    
    if (rating === 1) { 
      S = w[11] * Math.pow(D, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R));
    } else { 
      let e = Math.exp(w[8]) * (11 - D) * Math.pow(S, -w[9]) * (Math.exp(w[10] * (1 - R)) - 1);
      if (rating === 2) S = S * (1 + e * w[15]);
      if (rating === 3) S = S * (1 + e);
      if (rating === 4) S = S * (1 + e * w[16]);
    }
  }
  
  const retention = (fsrsSettings.retention || 90) / 100;
  let interval = S * (Math.pow(retention, 1 / Math.log(0.9)) - 1) * -1; 
  interval = Math.min(Math.max(Math.round(interval), 1), fsrsSettings.maxInterval || 36500);
  
  word.fsrs_S = S; 
  word.fsrs_D = D;
  word.nextReview = addDays(todayStr(), interval);
  word.lastReviewDate = new Date().toISOString();
  word.reviewCount = (word.reviewCount || 0) + 1;
  word.lastRating = rating;
  
  if (rating === 1) {
    word.wrongCount = (word.wrongCount || 0) + 1;
    word.proficiency = Math.max(0, (word.proficiency || 0) - 1);
  } else if (rating === 2) {
    word.wrongCount = (word.wrongCount || 0) + 1;
  } else if (rating === 3) {
    word.correctCount = (word.correctCount || 0) + 1;
    if (word.proficiency < 3) word.proficiency = Math.min(3, (word.proficiency || 0) + 1);
  } else if (rating === 4) {
    word.correctCount = (word.correctCount || 0) + 1;
    word.proficiency = Math.min(3, (word.proficiency || 0) + 2);
  }
  
  word.history = word.history || [];
  word.history.push({ date: todayStr(), rating, interval });
  if (word.history.length > 30) word.history = word.history.slice(-30);
  word.lastModified = new Date().toISOString();
  
  if (typeof logRatingToSheets === 'function') logRatingToSheets(word, rating);
  return word;
}

function getProficiencyLabel(level) { return ['🆕 New', '📘 Learning', '🔶 Familiar', '✅ Mastered'][level] || '🆕 New'; }
function getProficiencyBadge(level) { return ['badge-info', 'badge-warning', 'badge-primary', 'badge-success'][level] || 'badge-info'; }
function getAccuracy(word) {
  const total = (word.correctCount || 0) + (word.wrongCount || 0);
  if (total === 0) return null;
  return Math.round((word.correctCount / total) * 100);
}
