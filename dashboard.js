// Multi-Page Tracker Dashboard
class MultiPageTracker {
  constructor() {
    this.trackings = [];
    this.selectedTrackingId = null;
    this.trackingElements = new Map();
    this.snapshotElements = new Map();
  }

  init() {
    this.cacheDOM();
    this.attachListeners();
    this.loadTrackings();
    this.listenForChanges();
  }

  cacheDOM() {
    this.dom = {
      trackingsList: document.getElementById('trackings-list'),
      emptyTrackings: document.getElementById('empty-trackings'),
      addTrackingBtn: document.getElementById('add-tracking-btn'),
      addTrackingForm: document.getElementById('add-tracking-form'),
      cancelAddTracking: document.getElementById('cancel-add-tracking'),
      confirmAddTracking: document.getElementById('confirm-add-tracking'),
      newTrackingUrl: document.getElementById('new-tracking-url'),
      newMinInterval: document.getElementById('new-min-interval'),
      newMaxInterval: document.getElementById('new-max-interval'),
      currentTrackingName: document.getElementById('current-tracking-name'),
      globalStatus: document.getElementById('global-status'),
      deleteTrackingBtn: document.getElementById('delete-tracking-btn'),
      openPageBtn: document.getElementById('open-page-btn'),
      noSelectionState: document.getElementById('no-selection-state'),
      trackingDetails: document.getElementById('tracking-details'),
      statChanges: document.getElementById('stat-changes'),
      statTimer: document.getElementById('stat-timer'),
      statInterval: document.getElementById('stat-interval'),
      toggleTrackingBtn: document.getElementById('toggle-tracking-btn'),
      toggleText: document.getElementById('toggle-text'),
      playIcon: document.getElementById('play-icon'),
      pauseIcon: document.getElementById('pause-icon'),
      refreshNowBtn: document.getElementById('refresh-now-btn'),
      snapshotsGrid: document.getElementById('snapshots-grid'),
      noSnapshots: document.getElementById('no-snapshots'),
      clearSnapshotsBtn: document.getElementById('clear-snapshots-btn')
    };
  }

  attachListeners() {
    // Add tracking form
    this.dom.addTrackingBtn?.addEventListener('click', () => this.showAddForm());
    this.dom.cancelAddTracking?.addEventListener('click', () => this.hideAddForm());
    this.dom.confirmAddTracking?.addEventListener('click', () => this.addTracking());

    // Tracking controls
    this.dom.toggleTrackingBtn?.addEventListener('click', () => this.toggleTracking());
    this.dom.refreshNowBtn?.addEventListener('click', () => this.refreshNow());
    this.dom.deleteTrackingBtn?.addEventListener('click', () => this.deleteTracking());
    this.dom.openPageBtn?.addEventListener('click', () => this.openPage());
    this.dom.clearSnapshotsBtn?.addEventListener('click', () => this.clearSnapshots());

    // Enter key on URL input
    this.dom.newTrackingUrl?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTracking();
    });
  }

  showAddForm() {
    this.dom.addTrackingForm?.classList.remove('hidden');
    this.dom.newTrackingUrl?.focus();
  }

  hideAddForm() {
    this.dom.addTrackingForm?.classList.add('hidden');
    if (this.dom.newTrackingUrl) this.dom.newTrackingUrl.value = '';
  }

  addTracking() {
    const url = this.dom.newTrackingUrl?.value.trim();
    const min = parseInt(this.dom.newMinInterval?.value) || 30;
    const max = parseInt(this.dom.newMaxInterval?.value) || 60;

    if (!url || !this.isValidUrl(url)) {
      alert('Please enter a valid URL');
      return;
    }

    const tracking = {
      id: 'tracking_' + Date.now(),
      url: url,
      name: new URL(url).hostname,
      isTracking: false,
      minInterval: min,
      maxInterval: max,
      changeCount: 0,
      snapshots: [],
      lastRefresh: null,
      timeLeft: null
    };

    this.trackings.push(tracking);
    this.saveTrackings();
    this.hideAddForm();
    this.renderTrackingsList();
    this.selectTracking(tracking.id);
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  deleteTracking() {
    if (!this.selectedTrackingId) return;
    
    if (confirm('Are you sure you want to delete this tracking?')) {
      const tracking = this.trackings.find(t => t.id === this.selectedTrackingId);
      if (tracking?.isTracking) {
        chrome.runtime.sendMessage({ 
          action: 'STOP_TRACKING', 
          trackingId: this.selectedTrackingId 
        });
      }

      this.trackings = this.trackings.filter(t => t.id !== this.selectedTrackingId);
      this.saveTrackings();
      this.selectedTrackingId = null;
      this.renderTrackingsList();
      this.showEmptyState();
    }
  }

  toggleTracking() {
    if (!this.selectedTrackingId) return;

    const tracking = this.trackings.find(t => t.id === this.selectedTrackingId);
    if (!tracking) return;

    const newState = !tracking.isTracking;
    tracking.isTracking = newState;

    chrome.runtime.sendMessage({
      action: newState ? 'START_TRACKING' : 'STOP_TRACKING',
      trackingId: tracking.id,
      url: tracking.url,
      min: tracking.minInterval,
      max: tracking.maxInterval
    });

    this.saveTrackings();
    this.renderTrackingsList();
    this.renderTrackingDetails();
  }

  refreshNow() {
    if (!this.selectedTrackingId) return;
    
    const tracking = this.trackings.find(t => t.id === this.selectedTrackingId);
    if (!tracking) return;

    chrome.runtime.sendMessage({
      action: 'REFRESH_NOW',
      trackingId: tracking.id,
      url: tracking.url
    });
  }

  openPage() {
    if (!this.selectedTrackingId) return;
    
    const tracking = this.trackings.find(t => t.id === this.selectedTrackingId);
    if (tracking) {
      chrome.tabs.create({ url: tracking.url });
    }
  }

  clearSnapshots() {
    if (!this.selectedTrackingId) return;
    
    if (confirm('Clear all snapshots for this tracking?')) {
      const tracking = this.trackings.find(t => t.id === this.selectedTrackingId);
      if (tracking) {
        tracking.snapshots = [];
        tracking.changeCount = 0;
        this.saveTrackings();
        this.renderTrackingDetails();
      }
    }
  }

  loadTrackings() {
    chrome.storage.local.get(['trackings', 'selectedTrackingId'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to load trackings:', chrome.runtime.lastError);
        return;
      }

      this.trackings = result.trackings || [];
      this.selectedTrackingId = result.selectedTrackingId || null;

      // Migration: convert old single tracking to new format
      if (this.trackings.length === 0) {
        chrome.storage.local.get(['isTracking', 'currentTrackedUrl', 'changeCount', 'snapshots'], (oldData) => {
          if (oldData.currentTrackedUrl) {
            const migratedTracking = {
              id: 'tracking_' + Date.now(),
              url: oldData.currentTrackedUrl,
              name: new URL(oldData.currentTrackedUrl).hostname,
              isTracking: oldData.isTracking || false,
              minInterval: 30,
              maxInterval: 60,
              changeCount: oldData.changeCount || 0,
              snapshots: oldData.snapshots || [],
              lastRefresh: null,
              timeLeft: null
            };
            this.trackings = [migratedTracking];
            this.selectedTrackingId = migratedTracking.id;
            this.saveTrackings();
            this.renderTrackingsList();
            this.renderTrackingDetails();
          } else {
            this.renderTrackingsList();
          }
        });
      } else {
        this.renderTrackingsList();
        if (this.selectedTrackingId) {
          this.renderTrackingDetails();
        }
      }
    });
  }

  saveTrackings() {
    chrome.storage.local.set({
      trackings: this.trackings,
      selectedTrackingId: this.selectedTrackingId
    });
  }

  listenForChanges() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.trackings) {
        this.trackings = changes.trackings.newValue || [];
        this.renderTrackingsList();
        if (this.selectedTrackingId) {
          this.renderTrackingDetails();
        }
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'CHANGE_DETECTED' || message.action === 'TIMER_UPDATE') {
        this.loadTrackings();
      }
    });
  }

  selectTracking(id) {
    this.selectedTrackingId = id;
    this.saveTrackings();
    this.renderTrackingsList();
    this.renderTrackingDetails();
  }

  renderTrackingsList() {
    const list = this.dom.trackingsList;
    if (!list) return;

    if (this.trackings.length === 0) {
      list.innerHTML = '';
      this.dom.emptyTrackings?.classList.remove('hidden');
      return;
    }

    this.dom.emptyTrackings?.classList.add('hidden');

    // Update or create tracking items
    this.trackings.forEach(tracking => {
      let el = this.trackingElements.get(tracking.id);
      
      if (!el) {
        el = this.createTrackingElement(tracking);
        this.trackingElements.set(tracking.id, el);
        list.appendChild(el);
      }

      this.updateTrackingElement(el, tracking);
    });

    // Remove deleted elements
    const currentIds = new Set(this.trackings.map(t => t.id));
    for (const [id, el] of this.trackingElements) {
      if (!currentIds.has(id)) {
        el.remove();
        this.trackingElements.delete(id);
      }
    }
  }

  createTrackingElement(tracking) {
    const el = document.createElement('button');
    el.className = 'w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left group';
    el.onclick = () => this.selectTracking(tracking.id);
    return el;
  }

  updateTrackingElement(el, tracking) {
    const isSelected = tracking.id === this.selectedTrackingId;
    const isActive = tracking.isTracking;

    el.className = `w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left group ${
      isSelected 
        ? 'bg-indigo-500/10 border border-indigo-500/30' 
        : 'hover:bg-slate-800 border border-transparent'
    }`;

    el.innerHTML = `
      <div class="relative flex-shrink-0">
        <div class="w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}"></div>
        ${isActive ? '<div class="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>' : ''}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}">
          ${tracking.name}
        </p>
        <p class="text-xs text-slate-500 truncate">${tracking.url}</p>
      </div>
      ${tracking.changeCount > 0 ? `
        <span class="flex-shrink-0 px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">
          ${tracking.changeCount}
        </span>
      ` : ''}
    `;
  }

  showEmptyState() {
    this.dom.noSelectionState?.classList.remove('hidden');
    this.dom.trackingDetails?.classList.add('hidden');
    this.dom.globalStatus?.classList.add('hidden');
    this.dom.deleteTrackingBtn?.classList.add('hidden');
    this.dom.openPageBtn?.classList.add('hidden');
    this.dom.currentTrackingName && (this.dom.currentTrackingName.textContent = 'Select a tracking');
  }

  renderTrackingDetails() {
    const tracking = this.trackings.find(t => t.id === this.selectedTrackingId);
    if (!tracking) {
      this.showEmptyState();
      return;
    }

    this.dom.noSelectionState?.classList.add('hidden');
    this.dom.trackingDetails?.classList.remove('hidden');
    this.dom.globalStatus?.classList.remove('hidden');
    this.dom.deleteTrackingBtn?.classList.remove('hidden');
    this.dom.openPageBtn?.classList.remove('hidden');

    // Update header
    this.dom.currentTrackingName && (this.dom.currentTrackingName.textContent = tracking.name);

    // Update status badge
    const statusEl = this.dom.globalStatus;
    if (statusEl) {
      statusEl.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        tracking.isTracking 
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
          : 'bg-slate-800 text-slate-400 border-slate-700'
      }`;
      statusEl.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full ${tracking.isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
        ${tracking.isTracking ? 'Active' : 'Inactive'}
      `;
    }

    // Update stats
    if (this.dom.statChanges) this.dom.statChanges.textContent = tracking.changeCount || 0;
    if (this.dom.statTimer) {
      this.dom.statTimer.textContent = tracking.timeLeft 
        ? `${tracking.timeLeft}s` 
        : (tracking.isTracking ? 'Refreshing...' : '--');
    }
    if (this.dom.statInterval) {
      this.dom.statInterval.textContent = `${tracking.minInterval}-${tracking.maxInterval}s`;
    }

    // Update toggle button
    const isTracking = tracking.isTracking;
    this.dom.toggleText && (this.dom.toggleText.textContent = isTracking ? 'Stop Tracking' : 'Start Tracking');
    this.dom.toggleTrackingBtn?.classList.toggle('bg-red-500', isTracking);
    this.dom.toggleTrackingBtn?.classList.toggle('hover:bg-red-600', isTracking);
    this.dom.toggleTrackingBtn?.classList.toggle('bg-indigo-500', !isTracking);
    this.dom.toggleTrackingBtn?.classList.toggle('hover:bg-indigo-600', !isTracking);
    this.dom.playIcon?.classList.toggle('hidden', isTracking);
    this.dom.pauseIcon?.classList.toggle('hidden', !isTracking);

    // Render snapshots
    this.renderSnapshots(tracking.snapshots || []);
  }

  renderSnapshots(snapshots) {
    const grid = this.dom.snapshotsGrid;
    if (!grid) return;

    if (snapshots.length === 0) {
      grid.innerHTML = '';
      this.dom.noSnapshots?.classList.remove('hidden');
      return;
    }

    this.dom.noSnapshots?.classList.add('hidden');

    // Render in reverse order (newest first)
    const reversed = [...snapshots].reverse();
    
    reversed.forEach((snap, index) => {
      let el = this.snapshotElements.get(snap.timestamp);
      
      if (!el) {
        el = this.createSnapshotElement(snap);
        this.snapshotElements.set(snap.timestamp, el);
        
        // Insert at correct position
        if (index === 0) {
          grid.insertBefore(el, grid.firstChild);
        } else {
          grid.appendChild(el);
        }
      }
    });

    // Remove old snapshots
    const currentTimestamps = new Set(reversed.map(s => s.timestamp));
    for (const [timestamp, el] of this.snapshotElements) {
      if (!currentTimestamps.has(timestamp)) {
        el.remove();
        this.snapshotElements.delete(timestamp);
      }
    }
  }

  createSnapshotElement(snap) {
    const el = document.createElement('div');
    el.className = 'group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-all';
    el.dataset.timestamp = snap.timestamp;

    const date = new Date(snap.timestamp);
    const timeStr = date.toLocaleTimeString();
    const dateStr = date.toLocaleDateString();

    el.innerHTML = `
      <div class="aspect-video bg-slate-800 overflow-hidden">
        <img src="${snap.dataUrl}" alt="Snapshot" loading="lazy" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
      </div>
      <div class="p-3">
        <p class="text-sm font-medium text-white">${timeStr}</p>
        <p class="text-xs text-slate-500">${dateStr}</p>
      </div>
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
        <a href="${snap.dataUrl}" download="snapshot-${snap.timestamp}.png" 
          class="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm transition-colors">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    `;

    return el;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const tracker = new MultiPageTracker();
  tracker.init();
});
