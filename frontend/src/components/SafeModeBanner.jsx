import React, { useState, useEffect } from 'react';
import { configClient } from '../services/configClient.js';

/**
 * SafeModeBanner component
 * Shows a banner when Safe Mode is enabled
 */
function SafeModeBanner() {
  const [safeMode, setSafeMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;

    const checkSafeMode = async () => {
      try {
        const healthData = await configClient.health();
        setSafeMode(healthData.safeMode || false);
        setError(null);
      } catch (err) {
        console.error('Error checking Safe Mode status:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Check immediately
    checkSafeMode();

    // Check every 30 seconds
    intervalId = setInterval(checkSafeMode, 30000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Don't show banner if loading or error
  if (loading || error || !safeMode) {
    return null;
  }

  return (
    <div className="safe-mode-banner">
      <div className="safe-mode-content">
        <div className="safe-mode-icon">⚠️</div>
        <div className="safe-mode-text">
          <strong>Safe Mode Active:</strong> Write operations are disabled to protect the server.
        </div>
        <div className="safe-mode-actions">
          <button 
            className="safe-mode-refresh"
            onClick={() => window.location.reload()}
            title="Refresh page"
          >
            🔄
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafeModeBanner;
