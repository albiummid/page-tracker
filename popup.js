// Multi-Page Tracker Popup
class PopupController {
  constructor() {
    this.currentUrl = null;
    this.currentTracking = null;
    this.allTrackings = [];
    this.init();
  }

  init() {
    this.cacheDOM();
    this.attachListeners();
    this.loadCurrentPage();
    this.loadTrackings();
  }

  cacheDOM() {
    this.dom = {
      currentPage: document.getElementById('current-page'),
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text'),
      quickTrackToggle: document.getElementById('quick-track-toggle'),
      minInterval: document.getElementById('min-interval'),
      maxInterval: document.getElementById('max-interval'),
      intervalControls: document.getElementById('interval-controls'),
      trackingCount: document.getElementById('tracking-count'),
      activeTrackingsList: document.getElementById('active-trackings-list'),
      timerDisplay: document.getElementById('timer-display'),
      totalChanges: document.getElementById('total-changes'),
      openDashboard: document.getElementById('open-dashboard')
    };
  }

  attachListeners() {
    this.dom.quickTrackToggle?.addEventListener('change', () => this.toggleQuickTrack());
    this.dom.openDashboard?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      window.close();
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.trackings) {
        this.loadTrackings();
      }
    });
  }

  loadCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        this.currentUrl = tabs[0].url;
        const hostname = new URL(this.currentUrl).hostname;
        if (this.dom.currentPage) {
          this.dom.currentPage.textContent = hostname;
          this.dom.currentPage.title = this.currentUrl;
        }
        this.loadTrackings();
      }
    });
  }

  loadTrackings() {
    chrome.storage.local.get(['trackings'], (result) => {
      if (chrome.runtime.lastError) return;

      this.allTrackings = result.trackings || [];
      
      // Find tracking for current page
      this.currentTracking = this.allTrackings.find(t => {
        return t.url === this.currentUrl || 
               this.currentUrl?.startsWith(t.url) ||
               t.url.includes(new URL(this.currentUrl || 'http://localhost').hostname);
      });

      this.updateUI();
    });
  }

  updateUI() {
    // Update quick track toggle
    const isTracking = this.currentTracking?.isTracking || false;
    if (this.dom.quickTrackToggle) {
      this.dom.quickTrackToggle.checked = isTracking;
    }

    // Update status
    this.updateStatus(isTracking);

    // Update interval controls visibility
    if (this.dom.intervalControls) {
      this.dom.intervalControls.style.opacity = isTracking ? '0.5' : '1';
      this.dom.intervalControls.style.pointerEvents = isTracking ? 'none' : 'auto';
    }

    // Set interval values if tracking exists
    if (this.currentTracking) {
      if (this.dom.minInterval) this.dom.minInterval.value = this.currentTracking.minInterval || 30;
      if (this.dom.maxInterval) this.dom.maxInterval.value = this.currentTracking.maxInterval || 60;
    }

    // Update active trackings list
    this.renderActiveTrackings();

    // Update stats
    this.updateStats();
  }

  updateStatus(isTracking) {
    if (isTracking) {
      this.dom.statusDot?.classList.remove('bg-slate-500');
      this.dom.statusDot?.classList.add('bg-emerald-400');
      if (this.dom.statusText) this.dom.statusText.textContent = 'Active';
    } else {
      this.dom.statusDot?.classList.remove('bg-emerald-400');
      this.dom.statusDot?.classList.add('bg-slate-500');
      if (this.dom.statusText) this.dom.statusText.textContent = 'Idle';
    }
  }

  renderActiveTrackings() {
    const activeTrackings = this.allTrackings.filter(t => t.isTracking);
    
    if (this.dom.trackingCount) {
      this.dom.trackingCount.textContent = activeTrackings.length.toString();
    }

    const list = this.dom.activeTrackingsList;
    if (!list) return;

    if (activeTrackings.length === 0) {
      list.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">No active trackings</p>';
      return;
    }

    list.innerHTML = activeTrackings.map(tracking => `
      <div class="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></div>
          <span class="text-sm text-white truncate">${tracking.name}</span>
        </div>
        ${tracking.timeLeft ? `<span class="text-xs text-slate-400 flex-shrink-0">${tracking.timeLeft}s</span>` : ''}
      </div>
    `).join('');
  }

  updateStats() {
    // Calculate total changes
    const totalChanges = this.allTrackings.reduce((sum, t) => sum + (t.changeCount || 0), 0);
    if (this.dom.totalChanges) {
      this.dom.totalChanges.textContent = totalChanges.toString();
    }

    // Show time left for current tracking
    if (this.currentTracking?.timeLeft) {
      if (this.dom.timerDisplay) {
        this.dom.timerDisplay.textContent = `${this.currentTracking.timeLeft}s`;
      }
    } else {
      if (this.dom.timerDisplay) {
        this.dom.timerDisplay.textContent = '--';
      }
    }
  }

  toggleQuickTrack() {
    const isTracking = this.dom.quickTrackToggle?.checked || false;
    const min = parseInt(this.dom.minInterval?.value) || 30;
    const max = parseInt(this.dom.maxInterval?.value) || 60;

    if (!this.currentUrl) return;

    if (this.currentTracking) {
      // Update existing tracking
      this.currentTracking.isTracking = isTracking;
      this.currentTracking.minInterval = min;
      this.currentTracking.maxInterval = max;
      
      chrome.storage.local.set({ trackings: this.allTrackings }, () => {
        // Notify background
        chrome.runtime.sendMessage({
          action: isTracking ? 'START_TRACKING' : 'STOP_TRACKING',
          trackingId: this.currentTracking.id,
          url: this.currentTracking.url,
          min: min,
          max: max
        });
      });
    } else if (isTracking) {
      // Create new tracking
      const newTracking = {
        id: 'tracking_' + Date.now(),
        url: this.currentUrl,
        name: new URL(this.currentUrl).hostname,
        isTracking: true,
        minInterval: min,
        maxInterval: max,
        changeCount: 0,
        snapshots: [],
        lastRefresh: null,
        timeLeft: null
      };

      this.allTrackings.push(newTracking);
      chrome.storage.local.set({ 
        trackings: this.allTrackings,
        selectedTrackingId: newTracking.id 
      }, () => {
        // Notify background
        chrome.runtime.sendMessage({
          action: 'START_TRACKING',
          trackingId: newTracking.id,
          url: newTracking.url,
          min: min,
          max: max
        });
      });
    }

    this.updateUI();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
