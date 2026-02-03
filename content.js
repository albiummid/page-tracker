// Simple hash function for change detection
function getPageContentHash() {
    // We can use innerText for text content or innerHTML for structural changes
    // Focusing on text content is often more reliable for "content" changes
    const textContent = document.body.innerText;
    
    // A very basic string hash
    let hash = 0;
    for (let i = 0; i < textContent.length; i++) {
        const char = textContent.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}

function checkChange() {
    console.log('Page Tracker: Checking for changes...');
    if (!document.body) {
        console.log('Page Tracker: Body not ready, skipping check.');
        return;
    }

    chrome.storage.local.get(['isTracking', 'lastContentHash', 'currentTrackedUrl'], (result) => {
        if (!result.isTracking) {
            console.log('Page Tracker: Tracking is disabled.');
            return;
        }

        const currentUrl = window.location.href;
        const currentHash = getPageContentHash();
        
        console.log('Page Tracker: Current URL:', currentUrl);
        console.log('Page Tracker: Last Hash:', result.lastContentHash);
        console.log('Page Tracker: Current Hash:', currentHash);

        if (result.currentTrackedUrl === currentUrl) {
            if (result.lastContentHash && result.lastContentHash !== currentHash) {
                console.log('Page Tracker: Change detected! Sending message to background...');
                chrome.runtime.sendMessage({ action: 'CONTENT_CHANGED', url: currentUrl });
            } else {
                console.log('Page Tracker: No changes detected.');
            }
        } else {
            console.log('Page Tracker: URL changed or first run on this page.');
            chrome.storage.local.set({ currentTrackedUrl: currentUrl });
        }
        
        chrome.storage.local.set({ lastContentHash: currentHash });
    });
}

// Run comparison on load
checkChange();

// Optional: Observe DOM changes if we want real-time (but user asked for refresh-based)
// The background script handles the refresh, and this script runs on setiap load.
