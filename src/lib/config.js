/**
 * T1P Extension Configuration
 * 
 * Centralized config for Supabase credentials and environment settings.
 * This replaces hardcoded values scattered across extension files.
 */

const T1P_CONFIG = {
    // Supabase project reference (used to construct URLs)
    PROJECT_REF: 'ehdlgpgmhsgcecnggzqr',

    // Get the Supabase URL dynamically from project reference
    get SUPABASE_URL() {
        return `https://${this.PROJECT_REF}.supabase.co`;
    },

    // Supabase anonymous key (safe for client-side use)
    // This key has limited permissions enforced by RLS
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZGxncGdtaHNnY2VjbmdnenFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzM2ODYsImV4cCI6MjA4Mjk0OTY4Nn0.-kHi_NRb3jQoY7ACSTC_Ymu96RKmpODQYFfJ4TkxO8I',

    // Edge Function paths
    EDGE_FUNCTIONS: {
        PROCESS_LINKEDIN_METRICS: 'process-linkedin-metrics',
    },

    // Helper to get full Edge Function URL
    getEdgeFunctionUrl(functionName) {
        return `${this.SUPABASE_URL}/functions/v1/${functionName}`;
    },

    // Enable/disable debug logging (set to false for production)
    DEBUG_MODE: false,

    // Allowed storage key for extension
    STORAGE_KEY: 't1p_user_token',
};

// Make config globally available
if (typeof window !== 'undefined') {
    window.T1P_CONFIG = T1P_CONFIG;
}

// Export for modules that support it
if (typeof module !== 'undefined' && module.exports) {
    module.exports = T1P_CONFIG;
}
