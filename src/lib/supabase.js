// Supabase Client for Chrome Extension
// Using CDN-based Supabase client for browser compatibility

const PROJECT_REF = 'ehdlgpgmhsgcecnggzqr';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZGxncGdtaHNnY2VjbmdnenFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzM2ODYsImV4cCI6MjA4Mjk0OTY4Nn0.-kHi_NRb3jQoY7ACSTC_Ymu96RKmpODQYFfJ4TkxO8I';

// Initialize Supabase client (loaded from CDN in popup.html)
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
        console.error('[T1P] Supabase library not loaded from CDN');
        return null;
    }

    if (!supabaseClient) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[T1P Auth] Supabase client initialized successfully');
        } catch (error) {
            console.error('[T1P Auth] Failed to create Supabase client:', error);
            return null;
        }
    }

    return supabaseClient;
}

// Wait for Supabase library to load from CDN
async function waitForSupabase(timeout = 5000) {
    const startTime = Date.now();

    while (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for Supabase library to load');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return true;
}

// Authentication functions
async function login(email, password) {
    try {
        // Wait for Supabase library to load from local bundle
        try {
            await waitForSupabase();
        } catch (waitError) {
            console.error('[T1P Auth] Supabase library load error:', waitError);
            throw new Error('Failed to load authentication library. Please reload the extension.');
        }

        const client = initSupabase();
        if (!client) {
            throw new Error('Failed to initialize authentication. Please reload the extension and try again.');
        }

        // Validate inputs
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        const { data, error } = await client.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) {
            // Provide user-friendly error messages
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid email or password');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Please confirm your email address');
            } else {
                throw new Error(error.message || 'Login failed');
            }
        }

        if (!data || !data.session || !data.user) {
            throw new Error('Login failed: No session data returned');
        }

        // Store session in Chrome storage
        await chrome.storage.local.set({
            userToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userEmail: data.user.email,
            sessionExpiry: data.session.expires_at
        });

        console.log('[T1P Auth] Login successful for:', data.user.email);
        return data;

    } catch (error) {
        console.error('[T1P Auth] Login error:', error);
        throw error;
    }
}

async function logout() {
    try {
        // Always clear stored session first
        await chrome.storage.local.remove(['userToken', 'refreshToken', 'userEmail', 'sessionExpiry']);

        // Try to sign out from Supabase, but don't fail if it errors
        const client = initSupabase();
        if (client) {
            try {
                await client.auth.signOut();
                console.log('[T1P Auth] Supabase signOut successful');
            } catch (signOutError) {
                // Ignore sign out errors - local storage is already cleared
                console.warn('[T1P Auth] Supabase signOut failed (ignored):', signOutError.message);
            }
        }
    } catch (error) {
        console.error('[T1P Auth] Error during logout:', error);
        // Still try to clear storage even if something fails
        try {
            await chrome.storage.local.remove(['userToken', 'refreshToken', 'userEmail', 'sessionExpiry']);
        } catch (clearError) {
            console.error('[T1P Auth] Failed to clear storage:', clearError);
        }
        throw error;
    }
}

async function getSession() {
    try {
        const result = await chrome.storage.local.get(['userToken', 'userEmail', 'sessionExpiry', 'refreshToken']);

        // Check if we have a valid session structure (either valid token+email OR a refresh token)
        if (!result.refreshToken && (!result.userToken || !result.userEmail)) {
            console.log('[T1P Auth] No session found');
            return null;
        }

        // Check if session is expired
        let isExpired = false;
        if (result.sessionExpiry) {
            const expiryDate = new Date(result.sessionExpiry * 1000);
            const now = new Date();
            // Add 60s buffer
            if (expiryDate < new Date(now.getTime() + 60000)) {
                isExpired = true;
            }
        }

        // If expired and we have a refresh token, try to refresh
        if (isExpired && result.refreshToken) {
            console.log('[T1P Auth] Session expired, attempting refresh...');

            try {
                // Ensure Supabase is loaded
                await waitForSupabase();
                const client = initSupabase();

                if (!client) {
                    console.error('[T1P Auth] Cannot refresh: Supabase client init failed');
                    return null;
                }

                const { data, error } = await client.auth.setSession({
                    refresh_token: result.refreshToken,
                    access_token: result.userToken // Optional but good for context
                });

                if (error || !data.session) {
                    console.error('[T1P Auth] Refresh failed:', error);
                    await clearSession();
                    return null;
                }

                console.log('[T1P Auth] Session refreshed successfully');

                // Update storage with new session
                await chrome.storage.local.set({
                    userToken: data.session.access_token,
                    refreshToken: data.session.refresh_token,
                    userEmail: data.user.email,
                    sessionExpiry: data.session.expires_at
                });

                return {
                    token: data.session.access_token,
                    email: data.user.email,
                    expiry: data.session.expires_at
                };

            } catch (refreshError) {
                console.error('[T1P Auth] Refresh exception:', refreshError);
                await clearSession();
                return null;
            }
        }

        // If expired and NO refresh token, clear
        else if (isExpired) {
            console.log('[T1P Auth] Session expired and no refresh token available');
            await clearSession();
            return null;
        }

        // Valid session
        return {
            token: result.userToken,
            email: result.userEmail,
            expiry: result.sessionExpiry
        };

    } catch (error) {
        console.error('[T1P Auth] Error getting session:', error);
        return null;
    }
}

// Helper function to clear session without calling Supabase
async function clearSession() {
    try {
        await chrome.storage.local.remove(['userToken', 'refreshToken', 'userEmail', 'sessionExpiry']);
    } catch (error) {
        console.error('[T1P Auth] Error clearing session:', error);
    }
}

// Export functions for use in popup
window.T1PAuth = {
    login,
    logout,
    getSession,
    clearSession,
    initSupabase,
    waitForSupabase
};
