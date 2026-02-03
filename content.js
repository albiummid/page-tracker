// Multi-Page Tracker Content Script
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__pageTrackerInjected) {
    return;
  }
  window.__pageTrackerInjected = true;

  // Simple hash function for change detection
  function getPageContentHash() {
    const textContent = document.body ? document.body.innerText || '' : '';
    let hash = 0;
    for (let i = 0; i < textContent.length; i++) {
      const char = textContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString();
  }

  // Check for changes
  function checkChange() {
    const currentUrl = window.location.href;
    
    chrome.storage.local.get(['trackings'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Page Tracker: Storage error', chrome.runtime.lastError);
        return;
      }

      const trackings = result.trackings || [];
      
      // Find tracking that matches current URL
      const matchingTracking = trackings.find(tracking => {
        return tracking.isTracking && 
               (currentUrl === tracking.url || 
                currentUrl.startsWith(tracking.url) ||
                tracking.url.includes(new URL(currentUrl).hostname));
      });

      if (!matchingTracking) {
        return;
      }

      const currentHash = getPageContentHash();
      const lastHash = matchingTracking.lastContentHash;

      if (lastHash && lastHash !== currentHash) {
        console.log('Page Tracker: Change detected on', matchingTracking.id);
        
        chrome.runtime.sendMessage({ 
          action: 'CONTENT_CHANGED', 
          trackingId: matchingTracking.id,
          url: currentUrl
        });
      }

      // Update hash in storage
      matchingTracking.lastContentHash = currentHash;
      chrome.storage.local.set({ trackings: trackings });
    });
  }

  // Run check when page is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for dynamic content to settle
      setTimeout(checkChange, 1000);
    });
  } else {
    // Page already loaded, wait for any dynamic content
    setTimeout(checkChange, 1000);
  }

  // Also check after window fully loads (including images)
  window.addEventListener('load', () => {
    setTimeout(checkChange, 500);
  });

})();
