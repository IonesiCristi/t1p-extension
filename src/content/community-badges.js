// T1P Companion - Community Badges
// Adds ⭐️ Top 1% (SSI), 🚀 Contributor, 💎 Top 1% (Leads) badges next to user names on Skool

(function () {
    'use strict';

    const BADGE_API_URL = 'https://ehdlgpgmhsgcecnggzqr.supabase.co/functions/v1/get-community-badges';
    const CACHE_KEY = 't1p_badges_cache';
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    const BADGE_ATTR = 'data-t1p-badge-injected';

    // Badge label constants (for future i18n)
    const BADGE_LABELS = {
        popupTitle: 'Insigne T1P',
        ssiTop1: 'Top 1% SSI în industrie pe LinkedIn',
        contributor: 'A contribuit cu lead-uri luna aceasta',
        leadsTop1: 'Cel mai activ contributor luna aceasta',
        footer: 'T1P COMMUNITY RECOGNITION 👏',
    };

    let badgeData = null; // { badges: [...], month: "YYYY-MM" }
    let popupElement = null;
    let debounceTimer = null;

    // =========================================
    // Data Fetching & Caching
    // =========================================

    async function fetchBadgeData() {
        // Check cache first
        try {
            const cached = await chrome.storage.local.get(CACHE_KEY);
            if (cached[CACHE_KEY]) {
                const { data, timestamp } = cached[CACHE_KEY];
                if (Date.now() - timestamp < CACHE_TTL_MS) {
                    console.log('[T1P Badges] Using cached badge data');
                    return data;
                }
            }
        } catch (e) {
            console.warn('[T1P Badges] Cache read error:', e);
        }

        // Fetch fresh data
        try {
            console.log('[T1P Badges] Fetching badge data from API...');
            const response = await fetch(BADGE_API_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            // Cache it
            try {
                await chrome.storage.local.set({
                    [CACHE_KEY]: { data, timestamp: Date.now() }
                });
            } catch (e) {
                console.warn('[T1P Badges] Cache write error:', e);
            }

            console.log(`[T1P Badges] Fetched ${data.badges?.length || 0} badges for ${data.month}`);
            return data;
        } catch (e) {
            console.error('[T1P Badges] Fetch error:', e);
            return null;
        }
    }

    // =========================================
    // Badge Lookup
    // =========================================

    function findBadgesForLink(linkElement) {
        if (!badgeData || !badgeData.badges) return null;

        const href = linkElement.getAttribute('href');
        if (!href || !href.startsWith('/@')) return null;

        // Extract slug: "/@oliver-chircu-8905?g=t1p" -> "oliver-chircu-8905"
        const slug = href.replace('/@', '').split('?')[0];

        return badgeData.badges.find(b => b.skool_slug === slug) || null;
    }

    // =========================================
    // Badge Injection
    // =========================================

    function createBadgeSpan(type, text) {
        const span = document.createElement('span');
        span.className = `t1p-badge t1p-badge-${type}`;
        span.setAttribute('data-t1p-badge', type);
        span.textContent = text;
        span.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showBadgePopup(e);
        });
        return span;
    }

    function injectBadges() {
        if (!badgeData) return;

        // Find all user profile links
        const profileLinks = document.querySelectorAll('a[href^="/@"]');

        for (const link of profileLinks) {
            // Skip if already processed
            if (link.hasAttribute(BADGE_ATTR)) continue;

            // Skip avatar-only links (no text content or very short)
            const nameText = link.textContent?.trim();
            if (!nameText || nameText.length < 2) continue;

            // Skip links that contain only images (avatar links)
            if (link.querySelector('img') && !link.querySelector('span')) continue;

            const userBadges = findBadgesForLink(link);
            if (!userBadges) {
                link.setAttribute(BADGE_ATTR, 'none');
                continue;
            }

            // Find the name text container
            const nameSpan = link.querySelector('span span') || link.querySelector('span');
            if (!nameSpan) {
                link.setAttribute(BADGE_ATTR, 'no-span');
                continue;
            }

            // Create badge container
            const badgeContainer = document.createElement('span');
            badgeContainer.className = 't1p-badge-container';

            if (userBadges.ssi_top1) {
                badgeContainer.appendChild(createBadgeSpan('ssi', '⭐️ Top 1%'));
            }

            if (userBadges.leads_top1) {
                badgeContainer.appendChild(createBadgeSpan('leads-top', '💎 Top 1%'));
            } else if (userBadges.leads_contributor) {
                badgeContainer.appendChild(createBadgeSpan('leads', '🚀 Contributor'));
            }

            // Only inject if there are badges to show
            if (badgeContainer.children.length > 0) {
                // Insert after the innermost name span
                nameSpan.parentNode.insertBefore(badgeContainer, nameSpan.nextSibling);
            }

            link.setAttribute(BADGE_ATTR, 'done');
        }
    }

    // =========================================
    // Popup — shows ALL badge types in Romanian
    // =========================================

    function showBadgePopup(event) {
        dismissPopup();

        popupElement = document.createElement('div');
        popupElement.className = 't1p-badge-popup';
        popupElement.innerHTML = `
      <div class="t1p-badge-popup-header">${BADGE_LABELS.popupTitle}</div>
      <div class="t1p-badge-popup-body">
        <div class="t1p-badge-popup-row">⭐️ <strong>Top 1%</strong> — ${BADGE_LABELS.ssiTop1}</div>
        <div class="t1p-badge-popup-row">🚀 <strong>Contributor</strong> — ${BADGE_LABELS.contributor}</div>
        <div class="t1p-badge-popup-row">💎 <strong>Top 1%</strong> — ${BADGE_LABELS.leadsTop1}</div>
      </div>
      <div class="t1p-badge-popup-footer">${BADGE_LABELS.footer}</div>
    `;

        document.body.appendChild(popupElement);

        // Position near the badge
        const rect = event.target.getBoundingClientRect();
        const popupWidth = 280;
        const popupHeight = popupElement.offsetHeight;

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        let top = rect.bottom + 8;

        // Keep within viewport
        if (left < 10) left = 10;
        if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
        if (top + popupHeight > window.innerHeight - 10) {
            top = rect.top - popupHeight - 8;
        }

        popupElement.style.left = `${left}px`;
        popupElement.style.top = `${top}px`;

        // Dismiss handlers
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleEscapeKey);
        }, 10);
    }

    function dismissPopup() {
        if (popupElement) {
            popupElement.remove();
            popupElement = null;
        }
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleEscapeKey);
    }

    function handleOutsideClick(e) {
        if (popupElement && !popupElement.contains(e.target) && !e.target.classList.contains('t1p-badge')) {
            dismissPopup();
        }
    }

    function handleEscapeKey(e) {
        if (e.key === 'Escape') dismissPopup();
    }

    // =========================================
    // Initialization
    // =========================================

    async function init() {
        // Only run on t1p community pages
        if (!window.location.pathname.includes('/t1p')) return;

        console.log('[T1P Badges] Initializing...');
        badgeData = await fetchBadgeData();

        if (!badgeData || !badgeData.badges || badgeData.badges.length === 0) {
            console.log('[T1P Badges] No badge data available');
            return;
        }

        // Initial injection
        injectBadges();

        // Watch for DOM changes (Skool is a SPA, content changes dynamically)
        // Debounce to avoid excessive calls on rapid DOM mutations
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(injectBadges, 300);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        console.log('[T1P Badges] Observer active, watching for DOM changes');
    }

    // Start after a delay to let Skool render
    setTimeout(init, 2000);
})();
