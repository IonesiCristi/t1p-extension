// T1P Auth Syncer
// Runs on the main web app (localhost or production) to extract the auth session
// and pass it to the extension storage.

console.log("T1P Auth Syncer: Checking for session...");

function syncSession() {
    // Supabase usually stores session in localStorage under 'sb-<project-ref>-auth-token'
    // defined in @supabase/supabase-js default storage options.

    // TARGET: T1P-Backend (ehdlgpgmhsgcecnggzqr)
    const PROJECT_REF = 'ehdlgpgmhsgcecnggzqr';
    const authKey = `sb-${PROJECT_REF}-auth-token`;

    // Debug: Check what keys exist
    const allKeys = Object.keys(localStorage);
    const potentialKeys = allKeys.filter(key => key.startsWith('sb-') && key.endsWith('-auth-token'));

    if (potentialKeys.length > 0) {
        console.log("T1P Auth Syncer: Found Supabase tokens:", potentialKeys);
    }

    if (localStorage.getItem(authKey)) {
        const sessionStr = localStorage.getItem(authKey);
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                const token = session.access_token;

                if (token) {
                    console.log(`T1P Auth Syncer: Valid token found for ${PROJECT_REF}. Syncing...`);

                    // Send to background script
                    chrome.runtime.sendMessage({
                        action: 'sync_auth',
                        token: token,
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            // Extension might not be listening context
                        } else {
                            console.log("Sync message sent successfully.");
                        }
                    });
                }
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }
    } else {
        console.warn(`T1P Auth Syncer: No token found for project ${PROJECT_REF}. Please ensure you are logged into the correct Supabase project.`);
    }
}

// Check immediately and then every few seconds (in case of login)
syncSession();
setInterval(syncSession, 5000);
