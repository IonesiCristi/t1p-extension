// T1P Companion - Background Service Worker

// Constants
const ALARM_NAME = 't1p_daily_scrape';
// 24 hours in minutes
const SCRAPE_INTERVAL_MIN = 1440;
// Random jitter up to 60 minutes
const JITTER_MAX_MIN = 60;

// Setup alarm on install
chrome.runtime.onInstalled.addListener(() => {
    console.log("T1P Companion Installed. Scheduling alarms...");
    scheduleNextScrape();
});

// Alarm Handler
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log("Alarm fired: Starting LinkedIn Scrape...");
        performScrape();
        // Re-schedule execution to keep it somewhat randomized daily
        scheduleNextScrape();
    }
});

// Message Handler (Auth Sync & UI)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sync_auth') {
        console.log("Received Auth Token from Web App");
        chrome.storage.local.set({ userToken: message.token }, () => {
            console.log("Token saved.");
        });
        sendResponse({ status: 'ok' });
    }
    else if (message.action === 'force_scrape') {
        console.log("Force Scrape requested");
        performScrape();
        sendResponse({ status: 'ok' });
    }
    return true; // Keep channel open for async response
});

function scheduleNextScrape() {
    const jitter = Math.random() * JITTER_MAX_MIN;
    const delayInMinutes = SCRAPE_INTERVAL_MIN + jitter;

    chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: delayInMinutes
    });

    console.log(`Next scrape scheduled in ${delayInMinutes.toFixed(2)} minutes.`);
}

async function performScrape() {
    try {
        // 1. Fetch SSI Data
        const ssiResponse = await fetch('https://www.linkedin.com/sales/ssi?src=or-search&trk=lss-microsite_ssi-score-entry-page_get-your-ssi-score-button', {
            method: 'GET',
            headers: {
                'Accept': 'text/html'
            }
        });

        if (!ssiResponse.ok) {
            throw new Error(`SSI Fetch failed: ${ssiResponse.status}`);
        }
        const ssiHtml = await ssiResponse.text();

        // 2. Fetch Search Appearances
        const searchResponse = await fetch('https://www.linkedin.com/analytics/search-appearances/', {
            method: 'GET',
            headers: {
                'Accept': 'text/html'
            }
        });

        if (!searchResponse.ok) {
            throw new Error(`Search Fetch failed: ${searchResponse.status}`);
        }
        const searchHtml = await searchResponse.text();

        // 3. Send to Supabase Edge Function
        // Retrieve URL and Token from storage.
        // Default to Production URL
        const { supabaseUrl, userToken } = await chrome.storage.local.get(['supabaseUrl', 'userToken']);

        // PRODUCTION URL
        const targetUrl = 'https://ehdlgpgmhsgcecnggzqr.supabase.co/functions/v1/ingest-linkedin-html';

        if (!userToken) {
            console.warn("No User Token found. Please login to T1P.");
            return;
        }

        console.log(`Transmission: Sending to ${targetUrl}...`);

        await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ ssiHtml, searchHtml })
        });

        console.log("Transmission Successful.");

        // Save success timestamp
        await chrome.storage.local.set({ lastScrape: new Date().toISOString() });

    } catch (error) {
        console.error("Scrape Execution Failed:", error);
        // TODO: Log error state to storage for UI display
    }
}
