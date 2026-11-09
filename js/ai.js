/* ============================================================
   GEMINI AI LOOKUP ENGINE & LINGUISTIC METADATA GENERATOR
============================================================ */
const GEMINI_MODEL_BLACKLIST = ['tts', 'vision', 'image', 'embedding', 'embed', 'aqa', 'retrieval', 'answer', 'bison', 'gecko', 'palm', 'code', 'preview', 'exp', 'it-'];
const GEMINI_FALLBACK_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

function isModelAllowed(modelName) { return !GEMINI_MODEL_BLACKLIST.some(bad => modelName.toLowerCase().includes(bad)); }
function scoreModel(modelName) {
  let score = 0; const name = modelName.toLowerCase();
  if (name.includes('flash')) score += 30; if (name.includes('lite')) score += 10;
  if (name.includes('1.5')) score += 5; if (name.includes('2.0')) score += 15;
  if (name.includes('pro')) score -= 10; if (name.includes('preview')) score -= 20;
  return score;
}

async function fetchAvailableGeminiModels(apiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.models) return null;
    return data.models.map(m => m.name.replace('models/', '')).filter(isModelAllowed).sort((a, b) => scoreModel(b) - scoreModel(a));
  } catch (e) { return null; }
}

async function callGemini(apiKey, prompt, logId) {
  const log = logId ? (msg, type) => logLine(logId, msg, type) : () => {};
  let models = await fetchAvailableGeminiModels(apiKey) || [...GEMINI_FALLBACK_MODELS];
  
  const aiSchema = {
    type: "OBJECT",
    properties: {
      word: { type: "STRING" }, ipa: { type: "STRING" }, pos: { type: "STRING" }, meaning: { type: "STRING" }, definition: { type: "STRING" },
      examples: { type: "ARRAY", items: { type: "STRING" } }, collocations: { type: "ARRAY", items: { type: "STRING" } }, mnemonic: { type: "STRING" },
      wordAnatomy: { type: "STRING" }, commonMisspellings: { type: "STRING" },
      wordFamily: { type: "ARRAY", items: { type: "OBJECT", properties: { pos: { type: "STRING" }, word: { type: "STRING" }, meaning: { type: "STRING" } }, required: ["pos", "word", "meaning"] } },
      confusables: { type: "ARRAY", items: { type: "OBJECT", properties: { word: { type: "STRING" }, meaning: { type: "STRING" }, reason: { type: "STRING" } }, required: ["word", "meaning", "reason"] } },
      similarWords: { type: "ARRAY", items: { type: "OBJECT", properties: { word: { type: "STRING" }, meaning: { type: "STRING" }, usage_difference: { type: "STRING" } }, required: ["word", "meaning", "usage_difference"] } },
      phrasalVerbs: { type: "ARRAY", items: { type: "OBJECT", properties: { phrase: { type: "STRING" }, meaning: { type: "STRING" }, example: { type: "STRING" }}, required: ["phrase", "meaning", "example"] } }
    },
    required: ["word", "ipa", "pos", "meaning", "definition", "examples", "collocations", "mnemonic", "wordAnatomy", "commonMisspellings", "wordFamily", "confusables", "similarWords", "phrasalVerbs"]
  };

  for (let model of models) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1500, response_mime_type: "application/json", response_schema: aiSchema } })
      });
      clearTimeout(timer); const data = await res.json();
      if (!res.ok) continue;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, model };
    } catch (err) { continue; }
  }
  throw new Error('All Gemini models failed.');
}

function buildLookupPrompt(word) {
  return `You are an expert linguistics curriculum designer. Generate comprehensive lexical metadata for the English word: "${word}". Include its morphology (word anatomy), derivations (word family), phrasal verbs / combinations with prepositions and particles (e.g. if the word is 'look', include 'look up', 'look for', 'look after' with Arabic meanings and an example), dangerous confusables, common misspellings, synonyms with usage nuances, and Arabic translations. Return accurate data strictly conforming to the schema.`;
}

async function triggerLookup(bulkWord = null) {
  const isBulk = !!bulkWord;
  const word = isBulk ? bulkWord : document.getElementById('mWord').value.trim();
  if (!word) return showToast('Please enter a word first', 'warning');
  
  const apiKey = localStorage.getItem('vocabCoach_geminiKey') || '';
  const lookupBtn = isBulk ? null : document.getElementById('lookupBtn');
  const statusDiv = isBulk ? document.getElementById('bulkLookupStatus') : document.getElementById('lookupStatus');
  const logId = isBulk ? 'bulkLookupLog' : 'lookupLog';
  
  statusDiv.style.display = 'block'; clearLog(logId);
  if (lookupBtn) { lookupBtn.disabled = true; lookupBtn.textContent = '⏳ Analyzing...'; }
  logLine(logId, `Starting deep linguistic lookup for: "${word}"`, 'info');
  
  let result = {};
  if (apiKey) {
    try {
      const prompt = buildLookupPrompt(word);
      const { text, model } = await callGemini(apiKey, prompt, logId);
      result = JSON.parse(text); 
      logLine(logId, `✅ Deep lookup complete using ${model}`, 'ok');
    } catch (err) { logLine(logId, `Gemini failed: ${err.message}`, 'warn'); }
  }
  
  const prefix = isBulk ? 'b' : 'm';
  if (result.ipa)        document.getElementById(prefix+'Ipa').value        = result.ipa;
  if (result.meaning)    document.getElementById(prefix+'Meaning').value    = result.meaning;
  if (result.pos)        document.getElementById(prefix+'Pos').value        = result.pos;
  if (result.definition) document.getElementById(prefix+'Definition').value = result.definition;
  if (result.mnemonic)   document.getElementById(prefix+'Mnemonic').value   = result.mnemonic;
  
  // Set in-memory global state
  currentPhrasalVerbs = Array.isArray(result.phrasalVerbs) ? result.phrasalVerbs : [];
  currentSimilarWords = Array.isArray(result.similarWords) ? result.similarWords : [];
  currentWordFamily = Array.isArray(result.wordFamily) ? result.wordFamily : [];
  currentConfusables = Array.isArray(result.confusables) ? result.confusables : [];
  currentWordAnatomy = result.wordAnatomy || "";
  currentMisspellings = result.commonMisspellings || "";
  
  // Render visual preview inside modal
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
      phrasalPreview.innerHTML = '';
    }
  }

  if (result.examples && result.examples.length > 0) {
    document.getElementById(prefix+'Examples').value = result.examples.filter(e => e && e.trim()).join('\n');
  }
  if (!isBulk && result.collocations && result.collocations.length > 0) {
    result.collocations.filter(c => c && c.trim()).forEach(c => { if (!currentCollocations.includes(c.trim())) currentCollocations.push(c.trim()); });
    renderCollocTags();
  }
  
  if (lookupBtn) { lookupBtn.disabled = false; lookupBtn.textContent = '🤖 AI Lookup'; }
  return result;
}

async function testApiKey() {
  const key = document.getElementById('geminiKeyInput').value.trim();
  if (!key) return showToast('Please enter an API key to test', 'warning');
  document.getElementById('keyTestArea').style.display = 'block'; clearLog('keyTestLog');
  logLine('keyTestLog', '🔑 Testing API key...', 'info');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (res.ok) { logLine('keyTestLog', '✅ Key is valid and working!', 'ok'); showToast('✅ API key is valid!', 'success'); } 
    else { logLine('keyTestLog', `❌ Invalid API key. HTTP ${res.status}`, 'err'); }
  } catch(e) { logLine('keyTestLog', `❌ Network Error: ${e.message}`, 'err'); }
}
