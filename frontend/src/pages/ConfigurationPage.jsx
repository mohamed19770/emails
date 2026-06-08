import React, { useState, useEffect } from 'react';
import { configClient } from '../services/configClient.js';

/**
 * ConfigurationPage component
 * Admin interface for managing application configuration
 */
function ConfigurationPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [health, setHealth] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    siteName: '',
    defaultLanguage: 'en',
    enableRegistration: true,
    supportEmail: '',
    apiKeys: {
      openai: '',
      stripe: ''
    },
    runtime: {
      safeMode: false,
      maintenanceMode: false,
      logLevel: 'info',
      rateLimitRPS: 5
    }
  });

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
    loadHealth();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await configClient.fetchConfig();
      
      if (response.success) {
        setConfig(response.data);
        setFormData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load configuration');
      }
    } catch (err) {
      console.error('Configuration load error:', err);
      setError('Configuration unavailable. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    try {
      const healthData = await configClient.health();
      setHealth(healthData);
    } catch (err) {
      console.error('Health check error:', err);
    }
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleApiKeyChange = (keyName, value) => {
    setFormData(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [keyName]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await configClient.updateConfig(formData);
      
      if (response.success) {
        setConfig(response.data);
        setSuccess('Configuration saved successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(response.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSafeMode = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const newSafeMode = !formData.runtime.safeMode;
      const response = await configClient.toggleSafeMode(newSafeMode);
      
      if (response.success) {
        setFormData(prev => ({
          ...prev,
          runtime: {
            ...prev.runtime,
            safeMode: newSafeMode
          }
        }));
        setSuccess(`Safe Mode ${newSafeMode ? 'enabled' : 'disabled'} successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(response.error || 'Failed to toggle Safe Mode');
      }
    } catch (err) {
      console.error('Safe Mode toggle error:', err);
      setError(err.message || 'Failed to toggle Safe Mode');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    loadConfiguration();
    loadHealth();
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="page">
        <div className="container">
          <div className="error-banner">
            <h2>⚠️ Configuration Unavailable</h2>
            <p>{error}</p>
            <button onClick={handleRefresh} className="btn btn-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Configuration</h1>
          <p>Manage application settings and runtime configuration</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <strong>Success:</strong> {success}
          </div>
        )}

        <div className="config-grid">
          {/* General Settings */}
          <div className="config-section">
            <h2>General Settings</h2>
            
            <div className="form-group">
              <label htmlFor="siteName">Site Name</label>
              <input
                type="text"
                id="siteName"
                value={formData.siteName}
                onChange={(e) => handleInputChange('siteName', 'siteName', e.target.value)}
                placeholder="My Application"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="defaultLanguage">Default Language</label>
              <select
                id="defaultLanguage"
                value={formData.defaultLanguage}
                onChange={(e) => handleInputChange('defaultLanguage', 'defaultLanguage', e.target.value)}
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.enableRegistration}
                  onChange={(e) => handleInputChange('enableRegistration', 'enableRegistration', e.target.checked)}
                />
                Enable User Registration
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="supportEmail">Support Email</label>
              <input
                type="email"
                id="supportEmail"
                value={formData.supportEmail}
                onChange={(e) => handleInputChange('supportEmail', 'supportEmail', e.target.value)}
                placeholder="support@example.com"
              />
            </div>
          </div>

          {/* Runtime Settings */}
          <div className="config-section">
            <h2>Runtime Settings</h2>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.runtime.safeMode}
                  onChange={(e) => handleInputChange('runtime', 'safeMode', e.target.checked)}
                />
                Safe Mode
              </label>
              <small>Protect server by disabling write operations</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.runtime.maintenanceMode}
                  onChange={(e) => handleInputChange('runtime', 'maintenanceMode', e.target.checked)}
                />
                Maintenance Mode
              </label>
              <small>Put the application in maintenance mode</small>
            </div>

            <div className="form-group">
              <label htmlFor="logLevel">Log Level</label>
              <select
                id="logLevel"
                value={formData.runtime.logLevel}
                onChange={(e) => handleInputChange('runtime', 'logLevel', e.target.value)}
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="rateLimitRPS">Rate Limit (RPS)</label>
              <input
                type="number"
                id="rateLimitRPS"
                value={formData.runtime.rateLimitRPS}
                onChange={(e) => handleInputChange('runtime', 'rateLimitRPS', parseInt(e.target.value))}
                min="1"
                max="1000"
              />
              <small>Requests per second limit</small>
            </div>
          </div>

          {/* API Keys */}
          <div className="config-section">
            <h2>API Keys</h2>
            
            <div className="form-group">
              <label htmlFor="openaiKey">OpenAI API Key</label>
              <input
                type="password"
                id="openaiKey"
                value={formData.apiKeys.openai}
                onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                placeholder="sk-..."
              />
              <small>Leave empty to keep current value</small>
            </div>

            <div className="form-group">
              <label htmlFor="stripeKey">Stripe Public Key</label>
              <input
                type="password"
                id="stripeKey"
                value={formData.apiKeys.stripe}
                onChange={(e) => handleApiKeyChange('stripe', e.target.value)}
                placeholder="pk_..."
              />
              <small>Leave empty to keep current value</small>
            </div>
          </div>

          {/* System Status */}
          {health && (
            <div className="config-section">
              <h2>System Status</h2>
              
              <div className="status-grid">
                <div className="status-item">
                  <div className="status-label">Uptime</div>
                  <div className="status-value">{Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</div>
                </div>
                
                <div className="status-item">
                  <div className="status-label">Version</div>
                  <div className="status-value">{health.version}</div>
                </div>
                
                <div className="status-item">
                  <div className="status-label">Safe Mode</div>
                  <div className={`status-value ${health.safeMode ? 'status-warning' : 'status-ok'}`}>
                    {health.safeMode ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                
                <div className="status-item">
                  <div className="status-label">Maintenance</div>
                  <div className={`status-value ${health.maintenanceMode ? 'status-warning' : 'status-ok'}`}>
                    {health.maintenanceMode ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                
                <div className="status-item">
                  <div className="status-label">Database</div>
                  <div className={`status-value ${health.mongo?.ok ? 'status-ok' : 'status-error'}`}>
                    {health.mongo?.ok ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="config-actions">
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || formData.runtime.safeMode}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          
          <button 
            type="button" 
            className={`btn ${formData.runtime.safeMode ? 'btn-warning' : 'btn-secondary'}`}
            onClick={handleToggleSafeMode}
            disabled={saving}
          >
            {formData.runtime.safeMode ? 'Disable Safe Mode' : 'Enable Safe Mode'}
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={saving}
          >
            Refresh
          </button>
        </div>

        {formData.runtime.safeMode && (
          <div className="alert alert-warning">
            <strong>Safe Mode Active:</strong> Configuration changes are disabled while Safe Mode is enabled.
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfigurationPage;
