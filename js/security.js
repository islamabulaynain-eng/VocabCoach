/* ============================================================
   SECURITY GATE & REDIRECT LOCKING (KID-FRIENDLY)
============================================================ */

// 1. PIN Access Gate
(function enforceAccessControl() {
  const MASTER_PIN = "1234";
  const AUTH_KEY = "vocabCoach_accessGranted";
  if (localStorage.getItem(AUTH_KEY) === "true") return;

  const userPin = prompt("🔒 Restricted Access Portal\nPlease enter your security PIN:");
  if (userPin === MASTER_PIN) {
    localStorage.setItem(AUTH_KEY, "true");
  } else {
    document.write(`
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, sans-serif; background: #0f172a; color: #ef4444; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">🚫</div>
        <h1 style="font-size: 32px; margin-bottom: 8px;">Access Denied</h1>
        <p style="color: #94a3b8; font-size: 16px;">Invalid PIN. Refresh the page to try again.</p>
      </div>
    `);
    throw new Error("Access Denied");
  }
})();

// 2. Prevent Top-Level Window Navigation / External Redirects
window.addEventListener('beforeunload', function (e) {
  // Warn before leaving app accidentally
  e.preventDefault();
  e.returnValue = '';
});

// 3. Iframe Sandbox Policy for YouGlish
function enforceYouglishSecurity() {
  const container = document.getElementById('youglish-tab-widget');
  if (!container) return;

  const observer = new MutationObserver(() => {
    const iframe = container.querySelector('iframe');
    if (iframe && !iframe.dataset.securityLocked) {
      iframe.dataset.securityLocked = "true";
      // Restrict top-level redirects and popups while allowing script playback
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    }
  });

  observer.observe(container, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', enforceYouglishSecurity);
