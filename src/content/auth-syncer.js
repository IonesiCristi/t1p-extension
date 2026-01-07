// T1P Auth Syncer
// Runs on the main web app (localhost or production) to extract the auth session
// and pass it to the extension storage.

console.log("T1P Auth Syncer: Checking for session...");

function syncSession() {
    // Supabase usually stores session in localStorage under 'sb-<project-ref>-auth-token'
    // We need to find the correct key.

    // Heuristic: specific key for T1P
    // TODO: Replace 'YOUR_SUPABASE_PROJECT_REF' with actual ref from environment if possible, 
    // or search for the key starting with 'sb-' and ending with '-auth-token'.

    const localStorageKeys = Object.keys(localStorage);
    const authKey = localStorageKeys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));

    if (authKey) {
        const sessionStr = localStorage.getItem(authKey);
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                const token = session.access_token;

                if (token) {
                    console.log("T1P Auth Syncer: Token found. Syncing to extension...");

                    // Send to background script
                    chrome.runtime.sendMessage({
                        action: 'sync_auth',
                        token: token,
                        // We can also pass public key/url if we want to config it dynamically
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            // Extension might not be listening or installed ID mismatch if externall_connectable used
                            // But since this is a content script defined in manifest, it shares the messaging channel
                            console.log("Sync message sent.");
                        }
                    });
                }
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }
    }
}

// Check immediately and then every few seconds (in case of login)
syncSession();
setInterval(syncSession, 5000);
