let trackingTimer = null;
let currentTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background: Received message', message.action);
    if (message.action === 'START_TRACKING') {
        chrome.storage.local.set({ isTracking: true });
        startTracking(message.min, message.max);
    } else if (message.action === 'STOP_TRACKING') {
        chrome.storage.local.set({ isTracking: false });
        stopTracking();
    } else if (message.action === 'CONTENT_CHANGED') {
        handleContentChange(sender.tab.id, message.url || sender.tab.url);
    }
});

function startTracking(min, max) {
    stopTracking(); // Clear existing
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        currentTabId = tabs[0].id;
        const url = tabs[0].url;
        
        chrome.storage.local.set({ 
            currentTrackedUrl: url,
            lastContentHash: null // Reset hash to start fresh
        }, () => {
            scheduleNextRefresh(min, max);
        });
    });
}

function stopTracking() {
    if (trackingTimer) {
        clearTimeout(trackingTimer);
        trackingTimer = null;
    }
}

function scheduleNextRefresh(min, max) {
    const interval = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    let timeLeft = interval / 1000;

    const countdown = setInterval(() => {
        timeLeft--;
        chrome.runtime.sendMessage({ action: 'TIMER_UPDATE', timeLeft });
        if (timeLeft <= 0) clearInterval(countdown);
    }, 1000);

    trackingTimer = setTimeout(() => {
        chrome.tabs.reload(currentTabId, { bypassCache: true }, () => {
            // After reload, content script will run and check for changes
            scheduleNextRefresh(min, max);
        });
    }, interval);
}

function handleContentChange(tabId, url) {
    console.log('Background: Handling content change for', url);

    // Get tab and window info to ensure we capture the right thing
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
            console.error('Background: Could not get tab info');
            return;
        }

        // Focus window and tab
        chrome.windows.update(tab.windowId, { focused: true }, () => {
            chrome.tabs.update(tabId, { active: true }, () => {
                // Wait longer for the page to settle and paint
                setTimeout(() => {
                    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 100 }, (dataUrl) => {
                        const timestamp = new Date().getTime();
                        
                        if (chrome.runtime.lastError) {
                            console.error('Background: Snapshot failed:', chrome.runtime.lastError.message);
                        } else if (!dataUrl || dataUrl.length < 1000) {
                            console.error('Background: Captured image appears to be blank or too small');
                        } else {
                            console.log('Background: Snapshot captured successfully, size:', dataUrl.length);
                            // Save to downloads
                            const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            chrome.downloads.download({
                                url: dataUrl,
                                filename: `page-tracker-snapshots/snap-${fileTimestamp}.png`,
                                saveAs: false
                            });

                            // Save to storage for dashboard
                            chrome.storage.local.get(['snapshots'], (res) => {
                                const snaps = res.snapshots || [];
                                snaps.push({ timestamp, dataUrl, url });
                                if (snaps.length > 20) snaps.shift(); // Keep last 20
                                chrome.storage.local.set({ snapshots: snaps });
                            });
                        }

                        // Show Notification
                        chrome.notifications.create('notify-' + timestamp, {
                            type: 'basic',
                            iconUrl: 'icons/icon128.png',
                            title: '🚨 Change Detected!',
                            message: `Content updated on: ${url}. Snapshot saved.`,
                            priority: 2,
                            buttons: [{ title: 'Open Dashboard' }]
                        });
                    });
                }, 1500); // 1.5s delay to ensure paint
            });
        });
    });

    // Update count
    chrome.storage.local.get(['changeCount'], (result) => {
        const newCount = (result.changeCount || 0) + 1;
        chrome.storage.local.set({ changeCount: newCount });
        chrome.runtime.sendMessage({ action: 'CHANGE_DETECTED', newCount }).catch(() => {});
    });
}

// Notification button click handler
chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
    if (btnIdx === 0) {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    }
});
