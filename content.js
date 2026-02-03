// Multi-Page Tracker Content Script
(function() {
  'use strict';

  // Simple hash function for change detection
  function getPageContentHash() {
    const textContent = document.body.innerText || '';
    let hash = 0;
    for (let i = 0; i < textContent.length; i++) {
      const char = textContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString();
  }

  // Get current URL
  const currentUrl = window.location.href;

  // Check for changes
  function checkChange() {
    console.log('Page Tracker: Checking for changes...', currentUrl);

    if (!document.body) {
      console.log('Page Tracker: Body not ready, skipping check.');
      return;
    }

    // Get all trackings and find matching one
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
        console.log('Page Tracker: No active tracking found for', currentUrl);
        return;
      }

      console.log('Page Tracker: Found matching tracking', matchingTracking.id);

      const currentHash = getPageContentHash();
      const lastHash = matchingTracking.lastContentHash;

      console.log('Page Tracker: Last Hash:', lastHash);
      console.log('Page Tracker: Current Hash:', currentHash);

      // Check if content changed
      if (lastHash && lastHash !== currentHash) {
        console.log('Page Tracker: Change detected! Notifying background...');
        
        chrome.runtime.sendMessage({ 
          action: 'CONTENT_CHANGED', 
          trackingId: matchingTracking.id,
          url: currentUrl
        });
      } else {
        console.log('Page Tracker: No changes detected.');
      }

      // Update hash in storage
      matchingTracking.lastContentHash = currentHash;
      chrome.storage.local.set({ trackings: trackings });
    });
  }

  // Run comparison on load with a slight delay to ensure page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkChange, 500);
    });
  } else {
    setTimeout(checkChange, 500);
  }

  // Also check after window load event (images and other resources loaded)
  window.addEventListener('load', () => {
    setTimeout(checkChange, 1000);
  });

})();
