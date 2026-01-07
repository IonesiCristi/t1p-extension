// T1P Companion - Skool Injector

console.log("T1P Injector loaded on Skool.");

// Classes discovered from DOM analysis
// Main Content Wrapper (where we inject our view)
const SELECTOR_MAIN_WRAPPER = '.styled__ContentWrapper-sc-vae51c-4'; // Partial class match for robustness

// Tab Classes
const CLASS_NAV_CONTAINER = 'styled__HeaderLinks-sc-vae51c-11 jJmsRL';
const CLASS_LINK_ANCHOR = 'styled__ChildrenLink-sc-1brgbbt-1 fQYQam styled__RouteTabLink-sc-vae51c-7 YWcTf';
const CLASS_TAB_INNER = 'styled__RouteTab-sc-vae51c-8 jSMzCt'; // Inactive
const CLASS_TAB_INNER_ACTIVE = 'styled__RouteTab-sc-vae51c-8 gqBbFL'; // Active

function injectT1PTab() {
    // 1. Find the Navigation Bar
    const allDivs = Array.from(document.querySelectorAll('div'));
    const aboutDiv = allDivs.find(d => d.textContent.trim() === 'About' && d.className.includes('styled__RouteTab'));

    if (aboutDiv && aboutDiv.parentElement && aboutDiv.parentElement.tagName === 'A') {
        const aboutAnchor = aboutDiv.parentElement;
        const navContainer = aboutAnchor.parentElement;

        // Check if already injected
        if (document.getElementById('t1p-nav-item')) return;

        // Create the Anchor
        const t1pLink = document.createElement('a');
        t1pLink.id = 't1p-nav-item';
        t1pLink.href = '#';
        t1pLink.className = CLASS_LINK_ANCHOR;

        // Create Inner Div
        const innerDiv = document.createElement('div');
        innerDiv.className = CLASS_TAB_INNER;
        innerDiv.textContent = 'T1P Stats';

        t1pLink.appendChild(innerDiv);

        // Click Handler
        t1pLink.addEventListener('click', (e) => {
            e.preventDefault();
            activateT1PView(t1pLink, innerDiv);
        });

        // Insert
        navContainer.appendChild(t1pLink);

        // Monitor standard tabs to deactivate T1P view
        // We attach listeners to siblings to clean up our view if they are clicked
        Array.from(navContainer.children).forEach(child => {
            if (child.id !== 't1p-nav-item') {
                child.addEventListener('click', () => {
                    deactivateT1PView(innerDiv);
                });
            }
        });

    }
}

function activateT1PView(link, innerDiv) {
    // 1. Visual Active State
    // Reset other tabs visual state (Skool might do this, but we force our active state)
    // Actually, we just set ours to active. Skool's router will handle the others usually.
    innerDiv.className = CLASS_TAB_INNER_ACTIVE;

    // 2. Content Injection
    const contentWrapper = document.querySelector(SELECTOR_MAIN_WRAPPER);
    if (!contentWrapper) {
        console.error("T1P: Content wrapper not found.");
        return;
    }

    // Hide existing Skool content (usually the first child)
    // Note: Skool might re-render, so we hide whatever is there that isn't ours
    Array.from(contentWrapper.children).forEach(child => {
        if (child.id !== 't1p-dashboard-container') {
            child.style.display = 'none';
        }
    });

    // Show or Create T1P Container
    let t1pContainer = document.getElementById('t1p-dashboard-container');
    if (!t1pContainer) {
        t1pContainer = document.createElement('div');
        t1pContainer.id = 't1p-dashboard-container';
        t1pContainer.style.width = '100%';
        t1pContainer.style.minHeight = '80vh';
        // Skool header is fixed/absolute (~112px). Native content uses 144px margin.
        t1pContainer.style.marginTop = '144px';
        t1pContainer.innerHTML = `
            <iframe 
                src="http://localhost:3000/dashboard" 
                style="width: 100%; height: 100vh; border: none;"
                title="T1P Dashboard"
            ></iframe>
        `;
        contentWrapper.appendChild(t1pContainer);
    }
    t1pContainer.style.display = 'block';
}

function deactivateT1PView(innerDiv) {
    // Reset visual
    innerDiv.className = CLASS_TAB_INNER;

    // Reset Content
    const t1pContainer = document.getElementById('t1p-dashboard-container');
    if (t1pContainer) {
        t1pContainer.style.display = 'none';
    }

    // Show Skool Content
    const contentWrapper = document.querySelector(SELECTOR_MAIN_WRAPPER);
    if (contentWrapper) {
        Array.from(contentWrapper.children).forEach(child => {
            if (child.id !== 't1p-dashboard-container') {
                child.style.display = ''; // Restore default display
            }
        });
    }
}

// Observe DOM changes (Skool is a SPA, navigation might rebuild DOM)
const observer = new MutationObserver(() => {
    injectT1PTab();
    // Re-apply content hiding if we are supposed to be active?
    // This is tricky with SPA. For now, let's rely on user clicking.
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial attempt
setTimeout(injectT1PTab, 1500);
