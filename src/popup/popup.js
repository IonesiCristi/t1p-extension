document.getElementById('scrape-btn').addEventListener('click', () => {
    // Send message to background script to trigger scrape
    chrome.runtime.sendMessage({ action: 'force_scrape' }, (response) => {
        console.log('Scrape triggered');
    });
});
