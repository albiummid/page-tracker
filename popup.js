document.addEventListener('DOMContentLoaded', () => {
    const minIntervalInput = document.getElementById('min-interval');
    const maxIntervalInput = document.getElementById('max-interval');
    const trackingToggle = document.getElementById('tracking-toggle');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const timerDisplay = document.getElementById('timer');
    const changeCountDisplay = document.getElementById('change-count');
    const viewSnapshotsBtn = document.getElementById('view-snapshots');

    // Load saved settings
    chrome.storage.local.get(['isTracking', 'minInterval', 'maxInterval', 'changeCount'], (result) => {
        if (result.minInterval) minIntervalInput.value = result.minInterval;
        if (result.maxInterval) maxIntervalInput.value = result.maxInterval;
        if (result.isTracking) {
            trackingToggle.checked = true;
            updateStatusUI(true);
        }
        changeCountDisplay.textContent = result.changeCount || 0;
    });

    // Toggle logic
    trackingToggle.addEventListener('change', () => {
        const isTracking = trackingToggle.checked;
        const min = parseInt(minIntervalInput.value) || 30;
        const max = parseInt(maxIntervalInput.value) || 40;

        chrome.storage.local.set({ 
            isTracking, 
            minInterval: min, 
            maxInterval: max 
        }, () => {
            updateStatusUI(isTracking);
            chrome.runtime.sendMessage({ 
                action: isTracking ? 'START_TRACKING' : 'STOP_TRACKING',
                min,
                max
            });
        });
    });

    function updateStatusUI(active) {
        if (active) {
            statusIndicator.classList.add('active');
            statusText.textContent = 'Tracking';
        } else {
            statusIndicator.classList.remove('active');
            statusText.textContent = 'Idle';
            timerDisplay.textContent = '--:--';
        }
    }

    // Listen for timer updates from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'TIMER_UPDATE') {
            timerDisplay.textContent = message.timeLeft + 's';
        }
        if (message.action === 'CHANGE_DETECTED') {
            chrome.storage.local.get(['changeCount'], (res) => {
                changeCountDisplay.textContent = res.changeCount || 0;
            });
        }
    });

    viewSnapshotsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });
});
