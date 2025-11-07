let reelCount = 0;
let seenVideos = new WeakSet();
let totalTimeSpent = 0; // Track total time in seconds
let sessionStartTime = null;
let isInReelSection = false;
let lastActivityTime = Date.now();
const WATCH_THRESHOLD = 2 * 1000; // 2 seconds
const REEL_LIMIT = 50; // Block after 50 reels
const INACTIVE_THRESHOLD = 30 * 1000; // 30 seconds of inactivity stops timing
let notificationShown = false;
let isBlocked = false;
let timeTrackingInterval = null;

// Load saved data
chrome.storage.local.get(["reelCount", "isBlocked", "blockTimestamp", "totalTimeSpent"], (data) => {
  reelCount = data.reelCount || 0;
  totalTimeSpent = data.totalTimeSpent || 0;
  isBlocked = data.isBlocked || false;
  
  // Check if enough time has passed since blocking (24 hours)
  if (isBlocked && data.blockTimestamp) {
    const timeSinceBlock = Date.now() - data.blockTimestamp;
    const hoursWaited = timeSinceBlock / (1000 * 60 * 60);
    
    if (hoursWaited < 24) {
      // Still blocked
      isBlocked = true;
    } else {
      // 24 hours passed, auto-unblock
      isBlocked = false;
      chrome.storage.local.set({ isBlocked: false, blockTimestamp: null });
    }
  }
  
  showCounterOverlay(reelCount);
  
  if (reelCount >= REEL_LIMIT || isBlocked) {
    enableBlocking();
  } else {
    // Start time tracking if we're in reel section
    checkIfInReelSection();
  }
});

// Function to check if we're in reel section
function checkIfInReelSection() {
  const currentPath = window.location.pathname;
  const wasInReelSection = isInReelSection;
  isInReelSection = currentPath.includes('/reels/') || 
                   currentPath.includes('/explore/') ||
                   document.querySelector('video[playsinline]') !== null;
  
  if (isInReelSection && !wasInReelSection && !isBlocked) {
    startTimeTracking();
  } else if (!isInReelSection && wasInReelSection) {
    stopTimeTracking();
  }
}

// Function to start time tracking
function startTimeTracking() {
  if (timeTrackingInterval || isBlocked) return;
  
  sessionStartTime = Date.now();
  lastActivityTime = Date.now();
  
  timeTrackingInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityTime;
    
    // Only count time if user is active (moved mouse, scrolled, etc.)
    if (timeSinceActivity < INACTIVE_THRESHOLD) {
      totalTimeSpent += 1; // Add 1 second
      
      // Save every 10 seconds to avoid too frequent writes
      if (totalTimeSpent % 10 === 0) {
        chrome.storage.local.set({ totalTimeSpent });
      }
    }
  }, 1000);
  
  console.log("🕐 Started time tracking in reel section");
}

// Function to stop time tracking
function stopTimeTracking() {
  if (timeTrackingInterval) {
    clearInterval(timeTrackingInterval);
    timeTrackingInterval = null;
    
    // Save final time
    chrome.storage.local.set({ totalTimeSpent });
    console.log("⏹️ Stopped time tracking. Total time:", totalTimeSpent, "seconds");
  }
}

// Track user activity
function trackActivity() {
  lastActivityTime = Date.now();
}

// Add activity listeners
document.addEventListener('mousemove', trackActivity);
document.addEventListener('scroll', trackActivity);
document.addEventListener('click', trackActivity);
document.addEventListener('keydown', trackActivity);
document.addEventListener('touchstart', trackActivity);

// Function to show on-screen counter (WITHOUT time display)
function showCounterOverlay(count) {
  let counter = document.getElementById("reel-counter");
  if (!counter) {
    counter = document.createElement("div");
    counter.id = "reel-counter";
    counter.style.position = "fixed";
    counter.style.top = "20px";
    counter.style.right = "20px";
    counter.style.background = "#111";
    counter.style.color = "#fff";
    counter.style.padding = "10px 15px";
    counter.style.borderRadius = "10px";
    counter.style.fontSize = "16px";
    counter.style.zIndex = "9999";
    counter.style.fontWeight = "bold";
    counter.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
    document.body.appendChild(counter);
  }
  
  const remaining = Math.max(0, REEL_LIMIT - count);
  
  if (count >= REEL_LIMIT) {
    counter.innerHTML = `🚫 Limit reached! ${count}/${REEL_LIMIT}`;
    counter.style.background = "#dc2626";
  } else {
    counter.innerHTML = `🎯 Reels: ${count}/${REEL_LIMIT} (${remaining} left)`;
  }
}

// Remove the interval that was updating the counter every second
// Since we're no longer displaying time, we don't need to update it constantly

// Send notification when limit is reached
function showLimitNotification() {
  if (!notificationShown) {
    alert("🚫 You've reached your 50 reel limit! Reels and Explorer are now blocked until tomorrow.");
    notificationShown = true;
  }
}

// Create blocking overlay
function createBlockingOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "reel-blocking-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0, 0, 0, 0.95)";
  overlay.style.zIndex = "10000";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.flexDirection = "column";
  overlay.style.color = "#fff";
  overlay.style.textAlign = "center";
  overlay.style.fontSize = "24px";
  overlay.style.fontFamily = "Arial, sans-serif";
  
  const minutes = Math.floor(totalTimeSpent / 60);
  const seconds = totalTimeSpent % 60;
  
  overlay.innerHTML = `
    <div style="max-width: 400px; padding: 40px;">
      <h2 style="margin-bottom: 20px;">🚫 Daily Limit Reached</h2>
      <p style="margin-bottom: 20px; font-size: 18px; line-height: 1.5;">
        You've watched ${reelCount} reels today and spent ${minutes}m ${seconds}s watching reels.
      </p>
      <p style="margin-bottom: 20px; font-size: 16px; line-height: 1.5;">
        Take a break and come back tomorrow!
      </p>
      <p style="margin-bottom: 30px; font-size: 16px; opacity: 0.8;">
        You can still access your DMs and other Instagram features.
      </p>
      <button id="go-to-dm" style="
        padding: 12px 24px;
        background: #0095f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        margin-right: 10px;
      ">Go to DMs</button>
      <button id="go-to-home" style="
        padding: 12px 24px;
        background: #666;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
      ">Go to Home</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add click handlers
  document.getElementById("go-to-dm").addEventListener("click", () => {
    window.location.href = "https://www.instagram.com/direct/inbox/";
  });
  
  document.getElementById("go-to-home").addEventListener("click", () => {
    window.location.href = "https://www.instagram.com/";
  });
}

// Enable blocking functionality
function enableBlocking() {
  isBlocked = true;
  const blockTimestamp = Date.now();
  chrome.storage.local.set({ 
    isBlocked: true,
    blockTimestamp: blockTimestamp 
  });
  
  // Stop time tracking
  stopTimeTracking();
  
  // Block videos immediately
  blockVideos();
  
  // Check if we're on a blocked page
  const currentPath = window.location.pathname;
  if (currentPath.includes('/reels/') || currentPath.includes('/explore/')) {
    createBlockingOverlay();
  }
  
  // Monitor for navigation to blocked sections
  monitorNavigation();
}

// Block all videos on the page
function blockVideos() {
  const videos = document.querySelectorAll("video");
  videos.forEach(video => {
    video.pause();
    video.style.filter = "blur(10px)";
    video.style.pointerEvents = "none";
    
    // Create overlay for each video
    const videoContainer = video.closest('[role="button"]') || video.parentElement;
    if (videoContainer && !videoContainer.querySelector('.video-blocked-overlay')) {
      const overlay = document.createElement("div");
      overlay.className = "video-blocked-overlay";
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.background = "rgba(0, 0, 0, 0.8)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.color = "#fff";
      overlay.style.fontSize = "18px";
      overlay.style.fontWeight = "bold";
      overlay.style.zIndex = "999";
      overlay.style.cursor = "not-allowed";
      overlay.textContent = "🚫 Limit Reached";
      
      videoContainer.style.position = "relative";
      videoContainer.appendChild(overlay);
    }
  });
}

// Monitor navigation and block access to restricted areas
function monitorNavigation() {
  // Override click events on reels and explore links
  const blockedSelectors = [
    'a[href*="/reels/"]',
    'a[href="/explore/"]',
    'a[href*="/explore/"]',
    '[aria-label*="Reels"]',
    '[aria-label*="Explore"]'
  ];
  
  blockedSelectors.forEach(selector => {
    document.addEventListener('click', (e) => {
      if (e.target.matches(selector) || e.target.closest(selector)) {
        e.preventDefault();
        e.stopPropagation();
        alert("🚫 Reels and Explorer are blocked until tomorrow!");
        return false;
      }
    }, true);
  });
  
  // Monitor URL changes
  let currentUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      checkIfInReelSection();
      
      const path = window.location.pathname;
      if (path.includes('/reels/') || path.includes('/explore/')) {
        setTimeout(() => {
          if (window.location.pathname.includes('/reels/') || window.location.pathname.includes('/explore/')) {
            if (isBlocked) {
              createBlockingOverlay();
            }
          }
        }, 500);
      }
    }
  }, 500);
}

// Handle a new video when it becomes visible
function handleVideo(video) {
  if (seenVideos.has(video) || isBlocked) return;

  const checkAndCount = () => {
    if (isBlocked) return;
    
    const rect = video.getBoundingClientRect();
    const isVisible =
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight;
    const isPlaying = !video.paused && !video.ended;

    if (isVisible && isPlaying) {
      seenVideos.add(video);
      reelCount++;
      chrome.storage.local.set({ reelCount });
      showCounterOverlay(reelCount);
      console.log("📹 Reel watched for 2 seconds. Count:", reelCount);

      if (reelCount >= REEL_LIMIT) {
        showLimitNotification();
        enableBlocking();
      }
    }
  };

  setTimeout(checkAndCount, WATCH_THRESHOLD);
}

// Observe videos that become visible
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.target.tagName === "VIDEO") {
        if (isBlocked) {
          // Block this video immediately
          const video = entry.target;
          video.pause();
          video.style.filter = "blur(10px)";
          video.style.pointerEvents = "none";
        } else {
          handleVideo(entry.target);
        }
      }
    });
  },
  { threshold: 0.9 }
);

// Watch for new video elements and apply blocking if needed
setInterval(() => {
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    observer.observe(video);
    if (isBlocked) {
      blockVideos();
    }
  });
  
  // Also check if we're in reel section
  checkIfInReelSection();
}, 3000);

// Reset blocking at midnight (automatic only)
function checkForNewDay() {
  const today = new Date().toDateString();
  chrome.storage.local.get(["lastResetDate", "blockTimestamp"], (data) => {
    if (data.lastResetDate !== today) {
      // New day, reset everything
      chrome.storage.local.set({
        reelCount: 0,
        totalTimeSpent: 0,
        isBlocked: false,
        lastResetDate: today,
        blockTimestamp: null
      }, () => {
        reelCount = 0;
        totalTimeSpent = 0;
        isBlocked = false;
        notificationShown = false;
        showCounterOverlay(0);
        
        // Stop current time tracking
        stopTimeTracking();
        
        // Remove blocking overlay if it exists
        const overlay = document.getElementById("reel-blocking-overlay");
        if (overlay) {
          overlay.remove();
        }
        
        // Remove video overlays
        document.querySelectorAll('.video-blocked-overlay').forEach(el => el.remove());
        
        // Restore videos
        document.querySelectorAll("video").forEach(video => {
          video.style.filter = "none";
          video.style.pointerEvents = "auto";
        });
        
        // Restart time tracking if in reel section
        checkIfInReelSection();
      });
    }
  });
}

// Check for new day every minute
setInterval(checkForNewDay, 60000);
checkForNewDay(); // Check immediately on load

// Stop time tracking when page is about to unload
window.addEventListener('beforeunload', () => {
  stopTimeTracking();
});