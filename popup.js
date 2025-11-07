document.addEventListener("DOMContentLoaded", () => {
  const counter = document.getElementById("counter");
  const timeSpent = document.getElementById("time-spent");
  const status = document.getElementById("status");
  const unblockTime = document.getElementById("unblock-time");

  const REEL_LIMIT = 50;

  function formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  function formatTimeSpent(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function updateDisplay() {
    chrome.storage.local.get(["reelCount", "totalTimeSpent", "isBlocked", "blockTimestamp"], (data) => {
      const count = data.reelCount || 0;
      const totalTimeSpent = data.totalTimeSpent || 0;
      const isBlocked = data.isBlocked || false;
      const blockTimestamp = data.blockTimestamp;

      counter.textContent = `${count}/${REEL_LIMIT}`;
      timeSpent.textContent = formatTimeSpent(totalTimeSpent);

      // Update status and blocking info
      if (isBlocked && blockTimestamp) {
        const timeSinceBlock = Date.now() - blockTimestamp;
        const timeRemaining = (24 * 60 * 60 * 1000) - timeSinceBlock;
        
        if (timeRemaining > 0) {
          status.textContent = "🚫 BLOCKED";
          status.style.color = "#dc2626";
          status.style.fontWeight = "bold";
          
          unblockTime.textContent = `Unblocks in: ${formatTimeRemaining(timeRemaining)}`;
          unblockTime.style.display = "block";
        } else {
          // Should be unblocked now
          chrome.storage.local.set({ isBlocked: false, blockTimestamp: null });
          location.reload();
        }
      } else if (count >= REEL_LIMIT) {
        status.textContent = "🚫 LIMIT REACHED";
        status.style.color = "#dc2626";
        status.style.fontWeight = "bold";
        unblockTime.style.display = "none";
      } else {
        const remaining = REEL_LIMIT - count;
        status.textContent = `✅ ${remaining} reels remaining`;
        status.style.color = "#16a34a";
        unblockTime.style.display = "none";
      }
    });
  }

  // Initial display
  updateDisplay();

  // Update every second to show real-time changes
  setInterval(updateDisplay, 1000);
});