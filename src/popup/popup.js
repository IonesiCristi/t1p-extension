// T1P Companion - Popup Logic

let currentSession = null;

// Initialize popup on load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[T1P Popup] Initializing...');

    try {
        // Wait for Supabase library to load from CDN
        console.log('[T1P Popup] Waiting for Supabase library...');
        await window.T1PAuth.waitForSupabase();
        console.log('[T1P Popup] Supabase library loaded');

        // Initialize Supabase client
        window.T1PAuth.initSupabase();

        // Check for existing session
        await checkAuthState();

        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('[T1P Popup] Initialization error:', error);

        // Show error to user
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Failed to initialize extension. Please reload the extension and try again.';
            errorMessage.classList.add('show');
        }

        // Still setup event listeners so user can try to login
        setupEventListeners();
    }
});

async function checkAuthState() {
    try {
        currentSession = await window.T1PAuth.getSession();

        if (currentSession) {
            console.log('[T1P Popup] User is authenticated:', currentSession.email);
            showDashboard(currentSession);
        } else {
            console.log('[T1P Popup] User is not authenticated');
            showLogin();
        }
    } catch (error) {
        console.error('[T1P Popup] Error checking auth state:', error);
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginView').style.display = 'block';
    document.getElementById('dashboardView').classList.remove('show');
}

function showDashboard(session) {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('dashboardView').classList.add('show');
    document.getElementById('userEmail').textContent = session.email;
}

function setupEventListeners() {
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);

    // Logout button
    const btnLogout = document.getElementById('btnLogout');
    btnLogout.addEventListener('click', handleLogout);

    // Collect button
    const btnScrape = document.getElementById('btnScrape');
    btnScrape.addEventListener('click', handleCollect);
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btnLogin = document.getElementById('btnLogin');
    const errorMessage = document.getElementById('errorMessage');

    // Validate inputs
    if (!email || !password) {
        errorMessage.textContent = 'Please enter both email and password';
        errorMessage.classList.add('show');
        return;
    }

    // Hide previous errors
    errorMessage.classList.remove('show');

    // Show loading state
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span><span>Signing in...</span>';

    try {
        console.log('[T1P Popup] Attempting login...');
        const data = await window.T1PAuth.login(email, password);

        console.log('[T1P Popup] Login successful');
        currentSession = {
            token: data.session.access_token,
            email: data.user.email,
            expiry: data.session.expires_at
        };

        // Clear form
        document.getElementById('loginForm').reset();

        // Show dashboard
        showDashboard(currentSession);

    } catch (error) {
        console.error('[T1P Popup] Login failed:', error);

        // Show user-friendly error message
        let displayMessage = 'Login failed. Please try again.';
        if (error.message) {
            displayMessage = error.message;
        }

        errorMessage.textContent = displayMessage;
        errorMessage.classList.add('show');

    } finally {
        // Restore button state
        btnLogin.disabled = false;
        btnLogin.innerHTML = '<span>Sign In</span><span style="font-size: 18px;">→</span>';
    }
}

async function handleLogout() {
    const btnLogout = document.getElementById('btnLogout');

    try {
        btnLogout.disabled = true;
        btnLogout.textContent = 'Signing out...';

        console.log('[T1P Popup] Logging out...');
        await window.T1PAuth.logout();

        currentSession = null;
        showLogin();

        console.log('[T1P Popup] Logout successful');

    } catch (error) {
        console.error('[T1P Popup] Logout error:', error);

        // Even if logout fails, clear local session and show login
        // This handles cases where user wasn't actually logged in
        currentSession = null;

        // Try to clear storage manually as a fallback
        try {
            await window.T1PAuth.clearSession();
        } catch (clearError) {
            console.error('[T1P Popup] Failed to clear session:', clearError);
        }

        // Always show login view
        showLogin();

        // Only show error if it's not a "no session" type error
        if (!error.message?.includes('session') && !error.message?.includes('not initialized')) {
            console.warn('[T1P Popup] Showing error to user:', error.message);
        }

    } finally {
        btnLogout.disabled = false;
        btnLogout.textContent = 'Sign Out';
    }
}

async function handleCollect() {
    const btnScrape = document.getElementById('btnScrape');
    const messageArea = document.getElementById('messageArea');

    try {
        btnScrape.disabled = true;
        btnScrape.textContent = 'Collecting data...';
        messageArea.textContent = 'Starting LinkedIn data collection...';
        messageArea.style.color = '#94a3b8';

        console.log('[T1P Popup] Sending collection request to background script...');

        // Send message to background script
        const response = await chrome.runtime.sendMessage({
            action: 'COLLECT_LINKEDIN_STATS'
        });

        if (response.status === 'success') {
            console.log('[T1P Popup] Collection successful:', response);
            messageArea.textContent = '✓ Data collected successfully!';
            messageArea.style.color = '#4ade80';
        } else {
            throw new Error(response.message || 'Scraping failed');
        }

    } catch (error) {
        console.error('[T1P Popup] Collection failed:', error);
        messageArea.textContent = '✗ ' + (error.message || 'Failed to collect data');
        messageArea.style.color = '#fb7185';
    } finally {
        btnScrape.disabled = false;
        btnScrape.textContent = 'Collect LinkedIn Data';

        // Clear message after 5 seconds
        setTimeout(() => {
            messageArea.textContent = '';
        }, 5000);
    }
}
