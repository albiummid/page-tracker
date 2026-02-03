function updateUI() {
    chrome.storage.local.get(['isTracking', 'changeCount', 'currentTrackedUrl', 'snapshots'], (result) => {
        const statusBadge = document.getElementById('global-status');
        const statusText = statusBadge.querySelector('.text');
        const totalChanges = document.getElementById('total-changes');
        const trackedUrl = document.getElementById('tracked-url-display');
        const snapshotList = document.getElementById('snapshots-list');

        if (result.isTracking) {
            statusBadge.classList.add('active');
            statusText.textContent = 'Tracking Active';
        } else {
            statusBadge.classList.remove('active');
            statusText.textContent = 'Tracking Inactive';
        }

        totalChanges.textContent = result.changeCount || 0;
        trackedUrl.textContent = result.currentTrackedUrl || 'None';

        // Render snapshots
        const snapshots = result.snapshots || [];
        if (snapshots.length > 0) {
            snapshotList.innerHTML = '';
            snapshots.reverse().forEach(snap => {
                const item = document.createElement('div');
                item.className = 'snapshot-item';
                item.innerHTML = `
                    <img src="${snap.dataUrl}" alt="Snapshot">
                    <div class="snapshot-info">
                        <div class="snapshot-time">${new Date(snap.timestamp).toLocaleString()}</div>
                    </div>
                `;
                snapshotList.appendChild(item);
            });
        }
    });
}

document.getElementById('clear-logs').addEventListener('click', () => {
    chrome.storage.local.set({ snapshots: [], changeCount: 0 }, updateUI);
});

// Update every 2 seconds or on message
updateUI();
setInterval(updateUI, 2000);

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'CHANGE_DETECTED') {
        updateUI();
    }
});
