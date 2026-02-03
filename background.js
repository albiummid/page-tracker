// Multi-Page Tracker Background Service Worker
class MultiPageTrackerService {
  constructor() {
    this.trackings = new Map(); // trackingId -> tracking state
    this.timers = new Map(); // trackingId -> { timer, countdown, timeLeft }
    this.init();
  }

  init() {
    this.loadTrackings();
    this.setupMessageListener();
    this.setupStorageListener();
  }

  loadTrackings() {
    chrome.storage.local.get(['trackings'], (result) => {
      if (result.trackings) {
        result.trackings.forEach(tracking => {
          if (tracking.isTracking) {
            this.startTracking(tracking.id, tracking.url, tracking.minInterval, tracking.maxInterval);
          }
        });
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Background: Received message', message.action, message.trackingId);

      switch (message.action) {
        case 'START_TRACKING':
          this.startTracking(message.trackingId, message.url, message.min, message.max);
          sendResponse({ success: true });
          break;

        case 'STOP_TRACKING':
          this.stopTracking(message.trackingId);
          sendResponse({ success: true });
          break;

        case 'REFRESH_NOW':
          this.refreshPage(message.trackingId, message.url);
          sendResponse({ success: true });
          break;

        case 'CONTENT_CHANGED':
          this.handleContentChange(message.trackingId, sender.tab);
          sendResponse({ success: true });
          break;
      }

      return true;
    });
  }

  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.trackings) {
        const newTrackings = changes.trackings.newValue || [];
        const oldTrackings = changes.trackings.oldValue || [];

        // Check for stopped trackings
        oldTrackings.forEach(oldTracking => {
          const newTracking = newTrackings.find(t => t.id === oldTracking.id);
          if (oldTracking.isTracking && (!newTracking || !newTracking.isTracking)) {
            this.stopTracking(oldTracking.id);
          }
        });

        // Check for started trackings
        newTrackings.forEach(newTracking => {
          const oldTracking = oldTrackings.find(t => t.id === newTracking.id);
          if (newTracking.isTracking && (!oldTracking || !oldTracking.isTracking)) {
            if (!this.timers.has(newTracking.id)) {
              this.startTracking(newTracking.id, newTracking.url, newTracking.minInterval, newTracking.maxInterval);
            }
          }
        });
      }
    });
  }

  startTracking(trackingId, url, min, max) {
    // Prevent duplicate starts - check if already tracking this ID
    if (this.timers.has(trackingId)) {
      console.log('Background: Already tracking', trackingId, 'ignoring duplicate start');
      return;
    }

    // Stop existing timer for this tracking (in case there are orphaned timers)
    this.stopTracking(trackingId);

    console.log('Background: Starting tracking', trackingId, url);

    // Find or open the tab
    this.findOrOpenTab(url, (tabId) => {
      if (!tabId) {
        console.error('Background: Could not find or open tab for', url);
        return;
      }

      // Double-check timer wasn't created while we were opening the tab
      if (this.timers.has(trackingId)) {
        console.log('Background: Timer created while opening tab, aborting');
        return;
      }

      this.trackings.set(trackingId, {
        id: trackingId,
        url: url,
        tabId: tabId,
        minInterval: min,
        maxInterval: max,
        lastContentHash: null,
        isTracking: true
      });

      this.scheduleNextRefresh(trackingId, min, max);
    });
  }

  stopTracking(trackingId) {
    console.log('Background: Stopping tracking', trackingId);

    const timerData = this.timers.get(trackingId);
    if (timerData) {
      if (timerData.timer) {
        clearTimeout(timerData.timer);
        timerData.timer = null;
      }
      if (timerData.countdown) {
        clearInterval(timerData.countdown);
        timerData.countdown = null;
      }
      this.timers.delete(trackingId);
    }

    this.trackings.delete(trackingId);
    
    // Also clear the timeLeft in storage
    this.updateTrackingTimeLeft(trackingId, null);
  }

  findOrOpenTab(url, callback) {
    chrome.tabs.query({ url: url }, (tabs) => {
      if (tabs.length > 0) {
        callback(tabs[0].id);
      } else {
        // Try with wildcard
        const urlPattern = url + '*';
        chrome.tabs.query({ url: urlPattern }, (wildcardTabs) => {
          if (wildcardTabs.length > 0) {
            callback(wildcardTabs[0].id);
          } else {
            // Open new tab
            chrome.tabs.create({ url: url, active: false }, (tab) => {
              callback(tab?.id);
            });
          }
        });
      }
    });
  }

  scheduleNextRefresh(trackingId, min, max) {
    const tracking = this.trackings.get(trackingId);
    if (!tracking) return;

    // Clear any existing timers first to prevent overlap
    const existingTimer = this.timers.get(trackingId);
    if (existingTimer) {
      if (existingTimer.timer) clearTimeout(existingTimer.timer);
      if (existingTimer.countdown) clearInterval(existingTimer.countdown);
    }

    const interval = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    let timeLeft = Math.floor(interval / 1000);
    let lastUpdateTime = Date.now();

    // Update timeLeft in storage immediately
    this.updateTrackingTimeLeft(trackingId, timeLeft);

    // Countdown interval - update every second using Date diff for accuracy
    const countdown = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastUpdateTime) / 1000);
      
      if (elapsed >= 1) {
        timeLeft -= elapsed;
        lastUpdateTime = now;
        
        if (timeLeft > 0) {
          this.updateTrackingTimeLeft(trackingId, timeLeft);
        }
      }
      
      if (timeLeft <= 0) {
        clearInterval(countdown);
        this.updateTrackingTimeLeft(trackingId, 0);
      }
    }, 100);

    // Main refresh timer
    const timer = setTimeout(() => {
      clearInterval(countdown);
      this.timers.delete(trackingId);
      this.refreshPage(trackingId, tracking.url);
    }, interval);

    this.timers.set(trackingId, { timer, countdown, timeLeft, startTime: Date.now(), interval });
  }

  refreshPage(trackingId, url) {
    const tracking = this.trackings.get(trackingId);
    if (!tracking) return;

    console.log('Background: Refreshing page', trackingId, url);

    this.findOrOpenTab(url, (tabId) => {
      if (!tabId) {
        console.error('Background: Tab not found for refresh');
        return;
      }

      // Update tab ID
      tracking.tabId = tabId;

      chrome.tabs.reload(tabId, { bypassCache: true }, () => {
        // After reload, content script will check for changes
        // Only reschedule if tracking is still active
        const currentTracking = this.trackings.get(trackingId);
        if (currentTracking && currentTracking.isTracking !== false) {
          this.scheduleNextRefresh(trackingId, currentTracking.minInterval, currentTracking.maxInterval);
        }
      });
    });
  }

  updateTrackingTimeLeft(trackingId, timeLeft) {
    chrome.storage.local.get(['trackings'], (result) => {
      const trackings = result.trackings || [];
      const tracking = trackings.find(t => t.id === trackingId);
      if (tracking) {
        tracking.timeLeft = timeLeft;
        chrome.storage.local.set({ trackings });
      }
    });
  }

  handleContentChange(trackingId, tab) {
    console.log('Background: Content changed for tracking', trackingId);

    const tracking = this.trackings.get(trackingId);
    if (!tracking || !tab) {
      console.error('Background: No tracking or tab info for content change');
      return;
    }

    // Focus window and tab
    chrome.windows.update(tab.windowId, { focused: true }, () => {
      chrome.tabs.update(tab.id, { active: true }, () => {
        // Wait for page to settle
        setTimeout(() => {
          this.captureSnapshot(trackingId, tab.windowId, tracking.url);
        }, 1500);
      });
    });

    // Update change count
    this.incrementChangeCount(trackingId);
  }

  captureSnapshot(trackingId, windowId, url) {
    chrome.tabs.captureVisibleTab(windowId, { format: 'png', quality: 90 }, (dataUrl) => {
      const timestamp = Date.now();

      if (chrome.runtime.lastError) {
        console.error('Background: Snapshot failed:', chrome.runtime.lastError.message);
        return;
      }

      if (!dataUrl || dataUrl.length < 1000) {
        console.error('Background: Captured image appears blank or too small');
        return;
      }

      console.log('Background: Snapshot captured, size:', dataUrl.length);

      // Save to downloads
      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      chrome.downloads.download({
        url: dataUrl,
        filename: `page-tracker/${trackingId}/snap-${fileTimestamp}.png`,
        saveAs: false
      });

      // Save to storage
      this.saveSnapshot(trackingId, timestamp, dataUrl, url);

      // Show notification
      this.showNotification(trackingId, url);
    });
  }

  saveSnapshot(trackingId, timestamp, dataUrl, url) {
    chrome.storage.local.get(['trackings'], (result) => {
      const trackings = result.trackings || [];
      const tracking = trackings.find(t => t.id === trackingId);
      
      if (tracking) {
        if (!tracking.snapshots) tracking.snapshots = [];
        tracking.snapshots.push({ timestamp, dataUrl, url });
        
        // Keep only last 20 snapshots
        if (tracking.snapshots.length > 20) {
          tracking.snapshots.shift();
        }

        tracking.lastRefresh = timestamp;
        chrome.storage.local.set({ trackings });
      }
    });
  }

  incrementChangeCount(trackingId) {
    chrome.storage.local.get(['trackings'], (result) => {
      const trackings = result.trackings || [];
      const tracking = trackings.find(t => t.id === trackingId);
      
      if (tracking) {
        tracking.changeCount = (tracking.changeCount || 0) + 1;
        chrome.storage.local.set({ trackings }, () => {
          // Notify dashboard
          chrome.runtime.sendMessage({ 
            action: 'CHANGE_DETECTED', 
            trackingId: trackingId 
          }).catch(() => {});
        });
      }
    });
  }

  showNotification(trackingId, url) {
    const timestamp = Date.now();
    chrome.notifications.create(`notify-${trackingId}-${timestamp}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔔 Change Detected!',
      message: `Update on: ${new URL(url).hostname}`,
      priority: 2,
      buttons: [{ title: 'View Dashboard' }]
    });
  }
}

// Initialize service
const trackerService = new MultiPageTrackerService();

// Notification button click handler
chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (btnIdx === 0) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  trackerService.loadTrackings();
});

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  // Migrate old data if exists
  chrome.storage.local.get(['isTracking', 'currentTrackedUrl'], (oldData) => {
    if (oldData.currentTrackedUrl && !oldData.trackings) {
      const migratedTracking = {
        id: 'tracking_' + Date.now(),
        url: oldData.currentTrackedUrl,
        name: new URL(oldData.currentTrackedUrl).hostname,
        isTracking: oldData.isTracking || false,
        minInterval: 30,
        maxInterval: 60,
        changeCount: 0,
        snapshots: [],
        lastRefresh: null,
        timeLeft: null
      };
      chrome.storage.local.set({ 
        trackings: [migratedTracking],
        selectedTrackingId: migratedTracking.id 
      });
    }
  });
});
