// T1P Companion - Notification Badge Hider
// Hides the red notification number bubbles on Skool for a specific user only.
// Controlled by the popup toggle (stored as `hideNotificationBadges` in chrome.storage.local).

const BADGE_OWNER_EMAIL = 'ionesicristi@gmail.com';

// Attribute-substring selector — resilient to styled-components hash changes.
const BADGE_SELECTOR = '[class*="NotificationBubbleWrapper"]';
const STYLE_ID = 't1p-badge-hider-style';

function injectHiderStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${BADGE_SELECTOR} { display: none !important; }`;
    document.head.appendChild(style);
}

function removeHiderStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
}

function applyState(enabled) {
    if (enabled) {
        injectHiderStyle();
    } else {
        removeHiderStyle();
    }
}

// Read both email and toggle preference, then act.
chrome.storage.local.get(['userEmail', 'hideNotificationBadges'], (result) => {
    if (result.userEmail !== BADGE_OWNER_EMAIL) return;

    // Default to true (enabled) if the key hasn't been set yet.
    const enabled = result.hideNotificationBadges !== false;
    applyState(enabled);

    // Re-inject style after SPA navigation if still enabled.
    const observer = new MutationObserver(() => {
        if (enabled && !document.getElementById(STYLE_ID)) injectHiderStyle();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
});

// Listen for real-time toggle changes from the popup.
chrome.storage.onChanged.addListener((changes) => {
    if ('hideNotificationBadges' in changes) {
        chrome.storage.local.get(['userEmail'], (result) => {
            if (result.userEmail !== BADGE_OWNER_EMAIL) return;
            applyState(changes.hideNotificationBadges.newValue !== false);
        });
    }
});
