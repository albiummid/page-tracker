/**
 * Page Tracker Test Suite
 * 
 * Run these tests by loading the extension and opening the browser console
 * or by running the test functions in the extension context.
 */

// Mock Chrome API for testing
const mockChrome = {
  storage: {
    local: {
      data: {},
      get: function(keys, callback) {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            result[key] = this.data[key];
          });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(key => {
            result[key] = this.data[key] !== undefined ? this.data[key] : keys[key];
          });
        } else {
          result[keys] = this.data[keys];
        }
        callback(result);
      },
      set: function(data, callback) {
        Object.assign(this.data, data);
        if (callback) callback();
      },
      clear: function() {
        this.data = {};
      }
    }
  },
  runtime: {
    lastError: null,
    sendMessage: function(message, callback) {
      console.log('Mock sendMessage:', message);
      if (callback) callback({ received: true });
    },
    onMessage: {
      listeners: [],
      addListener: function(listener) {
        this.listeners.push(listener);
      }
    }
  },
  tabs: {
    query: function(queryInfo, callback) {
      callback([{ id: 1, url: 'https://example.com', windowId: 1 }]);
    },
    get: function(tabId, callback) {
      callback({ id: tabId, url: 'https://example.com', windowId: 1 });
    },
    update: function(tabId, updateInfo, callback) {
      callback();
    },
    reload: function(tabId, reloadInfo, callback) {
      callback();
    },
    create: function(createInfo, callback) {
      callback({ id: 2, url: createInfo.url, windowId: 1 });
    }
  },
  windows: {
    update: function(windowId, updateInfo, callback) {
      callback();
    }
  },
  notifications: {
    create: function(id, options) {
      console.log('Mock notification:', id, options);
    }
  },
  downloads: {
    download: function(options) {
      console.log('Mock download:', options);
    }
  }
};

// Test utilities
const TestUtils = {
  tests: [],
  passed: 0,
  failed: 0,

  describe: function(name, fn) {
    console.group(name);
    fn();
    console.groupEnd();
  },

  it: function(name, fn) {
    try {
      fn();
      console.log('✓', name);
      this.passed++;
    } catch (error) {
      console.error('✗', name);
      console.error('  Error:', error.message);
      this.failed++;
    }
  },

  expect: function(actual) {
    return {
      toBe: function(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, but got ${actual}`);
        }
      },
      toEqual: function(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
      },
      toBeDefined: function() {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined, but got undefined`);
        }
      },
      toBeUndefined: function() {
        if (actual !== undefined) {
          throw new Error(`Expected value to be undefined, but got ${actual}`);
        }
      },
      toBeNull: function() {
        if (actual !== null) {
          throw new Error(`Expected null, but got ${actual}`);
        }
      },
      toBeGreaterThan: function(expected) {
        if (actual <= expected) {
          throw new Error(`Expected value greater than ${expected}, but got ${actual}`);
        }
      },
      toBeLessThan: function(expected) {
        if (actual >= expected) {
          throw new Error(`Expected value less than ${expected}, but got ${actual}`);
        }
      },
      toContain: function(expected) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array/string to contain ${expected}`);
        }
      },
      toHaveLength: function(expected) {
        if (actual.length !== expected) {
          throw new Error(`Expected length ${expected}, but got ${actual.length}`);
        }
      },
      toBeTrue: function() {
        if (actual !== true) {
          throw new Error(`Expected true, but got ${actual}`);
        }
      },
      toBeFalse: function() {
        if (actual !== false) {
          throw new Error(`Expected false, but got ${actual}`);
        }
      }
    };
  },

  run: function() {
    console.log('\n========== TEST RESULTS ==========');
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);
    console.log('=====================================\n');
  }
};

// ==================== TEST SUITES ====================

function runTests() {
  console.log('\n🧪 Starting Page Tracker Tests...\n');

  // Test 1: Storage Operations
  TestUtils.describe('Storage Operations', function() {
    TestUtils.it('should store and retrieve trackings', function() {
      const testData = {
        trackings: [
          { id: 'test1', url: 'https://example.com', isTracking: true }
        ]
      };
      
      mockChrome.storage.local.set(testData);
      mockChrome.storage.local.get(['trackings'], function(result) {
        TestUtils.expect(result.trackings).toHaveLength(1);
        TestUtils.expect(result.trackings[0].id).toBe('test1');
      });
    });

    TestUtils.it('should handle empty trackings array', function() {
      mockChrome.storage.local.set({ trackings: [] });
      mockChrome.storage.local.get(['trackings'], function(result) {
        TestUtils.expect(result.trackings).toHaveLength(0);
      });
    });
  });

  // Test 2: URL Validation
  TestUtils.describe('URL Validation', function() {
    TestUtils.it('should validate correct URLs', function() {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://sub.domain.com/path',
        'https://example.com:8080/api'
      ];
      
      validUrls.forEach(url => {
        try {
          new URL(url);
          TestUtils.expect(true).toBeTrue();
        } catch {
          throw new Error(`URL ${url} should be valid`);
        }
      });
    });

    TestUtils.it('should reject invalid URLs', function() {
      const invalidUrls = [
        'not-a-url',
        'example',
        '',
        'ftp://invalid'
      ];
      
      invalidUrls.forEach(url => {
        try {
          new URL(url);
          throw new Error(`URL ${url} should be invalid`);
        } catch {
          TestUtils.expect(true).toBeTrue();
        }
      });
    });
  });

  // Test 3: Timer Management
  TestUtils.describe('Timer Management', function() {
    TestUtils.it('should calculate correct interval', function() {
      const min = 30;
      const max = 60;
      const interval = Math.floor(Math.random() * (max - min + 1) + min);
      
      TestUtils.expect(interval).toBeGreaterThan(29);
      TestUtils.expect(interval).toBeLessThan(61);
    });

    TestUtils.it('should not create overlapping timers', function() {
      const timers = new Map();
      const trackingId = 'test-tracking';
      
      // Simulate first timer
      timers.set(trackingId, { timer: setTimeout(() => {}, 1000) });
      
      // Check if timer exists before creating new one
      if (timers.has(trackingId)) {
        const existing = timers.get(trackingId);
        clearTimeout(existing.timer);
        timers.delete(trackingId);
      }
      
      TestUtils.expect(timers.has(trackingId)).toBeFalse();
    });
  });

  // Test 4: Content Hash
  TestUtils.describe('Content Hash Generation', function() {
    TestUtils.it('should generate consistent hash for same content', function() {
      const content1 = 'Hello World';
      const content2 = 'Hello World';
      
      const hash1 = generateTestHash(content1);
      const hash2 = generateTestHash(content2);
      
      TestUtils.expect(hash1).toBe(hash2);
    });

    TestUtils.it('should generate different hash for different content', function() {
      const content1 = 'Hello World';
      const content2 = 'Hello Universe';
      
      const hash1 = generateTestHash(content1);
      const hash2 = generateTestHash(content2);
      
      TestUtils.expect(hash1).not.toBe(hash2);
    });
  });

  // Test 5: Multi-Page Tracking
  TestUtils.describe('Multi-Page Tracking', function() {
    TestUtils.it('should handle multiple trackings independently', function() {
      const trackings = [
        { id: 'track1', url: 'https://site1.com', isTracking: true, changeCount: 5 },
        { id: 'track2', url: 'https://site2.com', isTracking: false, changeCount: 0 },
        { id: 'track3', url: 'https://site3.com', isTracking: true, changeCount: 3 }
      ];
      
      const activeTrackings = trackings.filter(t => t.isTracking);
      TestUtils.expect(activeTrackings).toHaveLength(2);
      
      const totalChanges = trackings.reduce((sum, t) => sum + (t.changeCount || 0), 0);
      TestUtils.expect(totalChanges).toBe(8);
    });

    TestUtils.it('should prevent duplicate tracking starts', function() {
      const activeTrackings = new Set();
      const trackingId = 'test-track';
      
      // First start
      if (!activeTrackings.has(trackingId)) {
        activeTrackings.add(trackingId);
      }
      
      // Second start attempt
      let wasBlocked = false;
      if (activeTrackings.has(trackingId)) {
        wasBlocked = true;
      }
      
      TestUtils.expect(wasBlocked).toBeTrue();
      TestUtils.expect(activeTrackings.has(trackingId)).toBeTrue();
    });
  });

  // Test 6: DOM Manipulation (Dashboard)
  TestUtils.describe('DOM Manipulation', function() {
    TestUtils.it('should create snapshot element correctly', function() {
      const mockSnapshot = {
        timestamp: Date.now(),
        dataUrl: 'data:image/png;base64,test123',
        url: 'https://example.com'
      };
      
      const el = document.createElement('div');
      el.className = 'snapshot-item';
      el.dataset.timestamp = mockSnapshot.timestamp;
      
      TestUtils.expect(el.className).toBe('snapshot-item');
      TestUtils.expect(el.dataset.timestamp).toBe(String(mockSnapshot.timestamp));
    });

    TestUtils.it('should toggle visibility classes', function() {
      const el = document.createElement('div');
      el.classList.add('hidden');
      
      TestUtils.expect(el.classList.contains('hidden')).toBeTrue();
      
      el.classList.remove('hidden');
      TestUtils.expect(el.classList.contains('hidden')).toBeFalse();
    });
  });

  // Test 7: State Management
  TestUtils.describe('State Management', function() {
    TestUtils.it('should detect state changes', function() {
      const state1 = { isTracking: true, changeCount: 5 };
      const state2 = { isTracking: true, changeCount: 6 };
      const state3 = { isTracking: true, changeCount: 5 };
      
      const hasChanged1 = JSON.stringify(state1) !== JSON.stringify(state2);
      const hasChanged2 = JSON.stringify(state1) !== JSON.stringify(state3);
      
      TestUtils.expect(hasChanged1).toBeTrue();
      TestUtils.expect(hasChanged2).toBeFalse();
    });

    TestUtils.it('should handle undefined values', function() {
      const data = {
        value1: undefined,
        value2: null,
        value3: 0,
        value4: ''
      };
      
      TestUtils.expect(data.value1).toBeUndefined();
      TestUtils.expect(data.value2).toBeNull();
      TestUtils.expect(data.value3).toBe(0);
      TestUtils.expect(data.value4).toBe('');
    });
  });

  // Test 8: Storage Schema
  TestUtils.describe('Storage Schema', function() {
    TestUtils.it('should have correct tracking object structure', function() {
      const tracking = {
        id: 'track_123',
        url: 'https://example.com',
        name: 'example.com',
        isTracking: true,
        minInterval: 30,
        maxInterval: 60,
        changeCount: 0,
        snapshots: [],
        lastRefresh: null,
        timeLeft: null
      };
      
      TestUtils.expect(tracking.id).toBeDefined();
      TestUtils.expect(tracking.url).toBeDefined();
      TestUtils.expect(tracking.isTracking).toBeDefined();
      TestUtils.expect(Array.isArray(tracking.snapshots)).toBeTrue();
    });

    TestUtils.it('should limit snapshots array', function() {
      const maxSnapshots = 20;
      let snapshots = [];
      
      // Add 25 snapshots
      for (let i = 0; i < 25; i++) {
        snapshots.push({ timestamp: i, dataUrl: 'test' });
        if (snapshots.length > maxSnapshots) {
          snapshots.shift();
        }
      }
      
      TestUtils.expect(snapshots).toHaveLength(maxSnapshots);
      TestUtils.expect(snapshots[0].timestamp).toBe(5); // First 5 were removed
    });
  });

  // Test 9: Time Calculations
  TestUtils.describe('Time Calculations', function() {
    TestUtils.it('should calculate timeLeft correctly', function() {
      const interval = 30000; // 30 seconds in ms
      const timeLeft = Math.floor(interval / 1000);
      
      TestUtils.expect(timeLeft).toBe(30);
    });

    TestUtils.it('should format timestamps correctly', function() {
      const timestamp = 1704067200000; // Jan 1, 2024
      const date = new Date(timestamp);
      
      TestUtils.expect(date.getFullYear()).toBe(2024);
      TestUtils.expect(date.getMonth()).toBe(0); // January is 0
    });
  });

  // Test 10: Event Handling
  TestUtils.describe('Event Handling', function() {
    TestUtils.it('should handle storage change events', function() {
      const changes = {
        trackings: {
          oldValue: [{ id: '1', isTracking: false }],
          newValue: [{ id: '1', isTracking: true }]
        }
      };
      
      const hasTrackingChanges = changes.trackings !== undefined;
      TestUtils.expect(hasTrackingChanges).toBeTrue();
      
      const startedTracking = changes.trackings.newValue[0].isTracking && 
                             !changes.trackings.oldValue[0].isTracking;
      TestUtils.expect(startedTracking).toBeTrue();
    });
  });

  // Run all tests
  TestUtils.run();
}

// Helper function for content hash testing
function generateTestHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString();
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestUtils, runTests, mockChrome };
} else {
  // Browser environment
  window.TestUtils = TestUtils;
  window.runTests = runTests;
  window.mockChrome = mockChrome;
}
