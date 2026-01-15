// T1P Companion - Background Service Worker

// Setup on install
chrome.runtime.onInstalled.addListener(() => {
    console.log("[T1P] T1P Companion Installed.");
});

// Configure Supabase
const PROJECT_REF = 'ehdlgpgmhsgcecnggzqr'; // T1P-Backend
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZGxncGdtaHNnY2VjbmdnenFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzM2ODYsImV4cCI6MjA4Mjk0OTY4Nn0.-kHi_NRb3jQoY7ACSTC_Ymu96RKmpODQYFfJ4TkxO8I'; // Added for apikey header
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-linkedin-metrics`;

// Message Handler (Auth Sync)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sync_auth') {
        console.log("[T1P] Received Auth Token from Web App");
        chrome.storage.local.set({ userToken: message.token }, () => {
            console.log("[T1P] Token saved.");
            sendResponse({ status: 'ok' });
        });
        return true; // Keep channel open
    }

    if (message.action === 'COLLECT_LINKEDIN_STATS') {
        console.log("[T1P] [COLLECT] Starting LinkedIn Data Collection (Clean Mode)...");

        // Get User Token from chrome.storage (set by popup login)
        chrome.storage.local.get(['userToken'], async (result) => {
            const token = result.userToken;
            if (!token) {
                console.error("[T1P] [COLLECT] No user token found. Please login via the extension popup.");
                sendResponse({ status: 'error', message: "Authentication required. Please login via the extension popup." });
                return;
            }

            try {
                // 2. Collect Data
                const data = await collectLinkedInData();
                console.log("[T1P] [COLLECT] Sequence Completed Successfully. Sending to Supabase...");

                // 3. Send to Supabase Edge Function
                const ssiPromise = sendDataToSupabase(data.ssi, 'ssi', token);
                const searchPromise = sendDataToSupabase(data.search_appearances, 'search_appearances', token);

                const [ssiResult, searchResult] = await Promise.all([ssiPromise, searchPromise]);

                console.log("[T1P] [COLLECT] Supabase Sync Results:", { ssiResult, searchResult });
                sendResponse({ status: 'success', data: { message: "Data captured and synced to Supabase", timestamp: data.timestamp } });
            } catch (err) {
                console.error("[T1P] [COLLECT] Sequence or Sync FAILED:", err);
                sendResponse({ status: 'error', message: err.toString() });
            }
        });
        return true; // Keep channel open
    }
    return true;
});

async function collectLinkedInData() {
    console.log("[T1P] [COLLECT] Step 1/2: Collecting SSI...");
    const ssiHTML = await collectSSI();

    // Human-like cooldown between pages (3-6 seconds)
    const cooldown = Math.floor(Math.random() * 3000) + 3000;
    console.log(`[T1P] [COLLECT] Cooling down for ${cooldown}ms...`);
    await new Promise(r => setTimeout(r, cooldown));

    console.log("[T1P] [COLLECT] Step 2/2: Collecting Search Appearances...");
    const searchHTML = await collectSearchAppearances();

    return {
        ssi: ssiHTML,
        search_appearances: searchHTML,
        timestamp: new Date().toISOString()
    };
}

/**
 * Sends extracted HTML to the Supabase Edge Function
 * @param {string} html Raw HTML content
 * @param {string} type 'ssi' or 'search_appearances'
 * @param {string} token Supabase Authentication Token
 */
async function sendDataToSupabase(html, type, token) {
    console.log(`[T1P] [SUPABASE] Sending ${type} data (${html.length} chars)...`);
    console.log(`[T1P] [SUPABASE] Token (first 50 chars): ${token?.substring(0, 50)}...`);
    console.log(`[T1P] [SUPABASE] Token length: ${token?.length}`);

    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY // Added as requested by Supabase Gateways
            },
            body: JSON.stringify({
                html: html,
                type: type,
                date: new Date().toISOString().split('T')[0] // Use current date
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error(`[T1P] [SUPABASE] Edge Function returned error. Status: ${response.status}, Body:`, result);
            throw new Error(`Edge Function Error (${response.status}): ${JSON.stringify(result)}`);
        }

        console.log(`[T1P] [SUPABASE] Success for ${type}:`, result);
        return result;
    } catch (err) {
        console.error(`[T1P] [SUPABASE] Failed to send ${type} data:`, err);
        throw err;
    }
}

// Helper: Random delay between min and max ms
const randomDelay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

async function collectSSI() {
    const url = 'https://www.linkedin.com/sales/ssi';
    console.log(`[T1P] [SSI] Opening background tab: ${url}`);

    let tabId = null;
    try {
        // 1. Create Background Tab
        const tab = await chrome.tabs.create({ url, active: false });
        tabId = tab.id;
        console.log(`[T1P] [SSI] Tab created (ID: ${tabId}). Waiting for load...`);

        // 2. Wait for Page Load
        await new Promise((resolve, reject) => {
            const listener = (tid, changeInfo) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            // Timeout after 15s
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error("Timeout waiting for SSI page load"));
            }, 15000);
        });
        console.log("[T1P] [SSI] Page loaded. Waiting for human-like interaction delay...");
        await randomDelay(2000, 4000); // Wait 2-4s before reading
        console.log("[T1P] [SSI] Injecting extraction script...");


        // 3. Inject Script (Isolated World) to get HTML
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                return document.documentElement.outerHTML;
            }
        });

        const html = results[0].result;
        console.log(`[T1P] [SSI] HTML captured (${html.length} chars).`);
        return html;

    } catch (err) {
        console.error("[T1P] [SSI] Error:", err);
        throw err;
    } finally {
        // 4. Cleanup
        if (tabId) {
            console.log(`[T1P] [SSI] Cleaning up tab ${tabId}...`);
            await chrome.tabs.remove(tabId).catch(() => { });
        }
    }
}

async function collectSearchAppearances() {
    const url = 'https://www.linkedin.com/analytics/search-appearances/';
    console.log(`[T1P] [SEARCH] Opening background tab: ${url}`);

    let tabId = null;
    try {
        const tab = await chrome.tabs.create({ url, active: false });
        tabId = tab.id;
        console.log(`[T1P] [SEARCH] Tab created (ID: ${tabId}). Waiting for load...`);

        await new Promise((resolve, reject) => {
            const listener = (tid, changeInfo) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error("Timeout waiting for Search Appearances page load"));
            }, 15000);
        });
        console.log("[T1P] [SEARCH] Page loaded. Waiting for human-like interaction delay...");
        await randomDelay(2000, 4000); // Wait 2-4s before interacting
        console.log("[T1P] [SEARCH] Injecting extraction script...");

        // Inject script to click dropdown and read data
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                const randomSleep = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1)) + min);

                console.log("[T1P] [SEARCH] Checking for dropdown button...");
                // 1. Click "Where you appeared" / "Dropdown" to open menu
                // Selector confirmed via live page investigation
                const dropdownBtn = document.querySelector('button.member-analytics-addon-chart-module__dropdown-button');

                if (dropdownBtn) {
                    console.log("[T1P] [SEARCH] Dropdown button found. Clicking...");
                    dropdownBtn.click();
                    await randomSleep(1500, 2500); // Wait for menu to render

                    // 2. Find "Job titles you were found for"
                    // Selector confirmed: li[aria-label="Job titles you were found for"]
                    // Also keeping a fallback to text content just in case aria-label changes
                    let targetItem = document.querySelector('li[aria-label="Job titles you were found for"]');

                    if (!targetItem) {
                        console.log("[T1P] [SEARCH] Aria-label selector failed. Trying text fallback...");
                        const items = Array.from(document.querySelectorAll('li[role="menuitem"], .artdeco-dropdown__item'));
                        targetItem = items.find(el => el.innerText && el.innerText.includes('Job titles you were found for'));
                    }

                    if (targetItem) {
                        console.log("[T1P] [SEARCH] Target item found. Clicking...");
                        targetItem.click();
                        // Wait longer for the new chart data to fetch and render
                        await randomSleep(3000, 5000);
                    } else {
                        console.warn("[T1P] [SEARCH] 'Job titles you were found for' option NOT found in dropdown.");
                    }
                } else {
                    console.warn("[T1P] [SEARCH] Dropdown button NOT found.");
                }

                // 3. Return Full HTML
                return document.documentElement.outerHTML;
            }
        });

        const html = results[0].result;
        console.log(`[T1P] [SEARCH] HTML captured (${html.length} chars).`);
        return html;

    } catch (err) {
        console.error("[T1P] [SEARCH] Error:", err);
        throw err;
    } finally {
        if (tabId) {
            console.log(`[T1P] [SEARCH] Cleaning up tab ${tabId}...`);
            await chrome.tabs.remove(tabId).catch(() => { });
        }
    }
}
