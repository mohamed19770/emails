import React, { useState, useEffect } from 'react';
import { configClient } from '../services/configClient.js';

function Configuration() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    siteName: "My App",
    defaultLanguage: "en",
    enableRegistration: true,
    supportEmail: "support@example.com",
    apiKeys: {
      openai: "",
      stripe: ""
    },
    runtime: {
      safeMode: false,
      maintenanceMode: false,
      logLevel: "info",
      rateLimitRPS: 5
    }
  });

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await configClient.fetchConfig();
      if (response.success) {
        setConfig(response.data);
        setFormData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load configuration');
      }
    } catch (error) {
      setError('Failed to load configuration');
      console.error('Configuration load error:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleInputChange = (field, value) => {
    if (field === 'apiKeys') {
      setFormData(prev => ({
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          ...value
        }
      }));
    } else if (field === 'runtime') {
      setFormData(prev => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          ...value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
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
    } catch (error) {
      setError(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Reset to default values
      const defaultConfig = {
        siteName: "My App",
        defaultLanguage: "en",
        enableRegistration: true,
        supportEmail: "support@example.com",
        apiKeys: {
          openai: "",
          stripe: ""
        },
        runtime: {
          safeMode: false,
          maintenanceMode: false,
          logLevel: "info",
          rateLimitRPS: 5
        }
      };
      
      setConfig(defaultConfig);
      setFormData(defaultConfig);
      setSuccess('Configuration reset to defaults');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.message || 'Failed to reset configuration');
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Configuration</h1>
          <p>Manage runtime settings and Safe Mode protection</p>
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
                onChange={(e) => handleInputChange('siteName', e.target.value)}
                placeholder="My App"
              />
              <small>Display name for the application</small>
            </div>

            <div className="form-group">
              <label htmlFor="defaultLanguage">Default Language</label>
              <select
                id="defaultLanguage"
                value={formData.defaultLanguage}
                onChange={(e) => handleInputChange('defaultLanguage', e.target.value)}
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
              <small>Default language for the application</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.enableRegistration}
                  onChange={(e) => handleInputChange('enableRegistration', e.target.checked)}
                />
                Enable Registration
              </label>
              <small>Allow new user registrations</small>
            </div>

            <div className="form-group">
              <label htmlFor="supportEmail">Support Email</label>
              <input
                type="email"
                id="supportEmail"
                value={formData.supportEmail}
                onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                placeholder="support@example.com"
              />
              <small>Contact email for support</small>
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
                onChange={(e) => handleInputChange('apiKeys', { openai: e.target.value })}
                placeholder="sk-..."
              />
              <small>OpenAI API key for AI features</small>
            </div>

            <div className="form-group">
              <label htmlFor="stripeKey">Stripe API Key</label>
              <input
                type="password"
                id="stripeKey"
                value={formData.apiKeys.stripe}
                onChange={(e) => handleInputChange('apiKeys', { stripe: e.target.value })}
                placeholder="sk_..."
              />
              <small>Stripe API key for payments</small>
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
                  onChange={(e) => handleInputChange('runtime', { safeMode: e.target.checked })}
                />
                Safe Mode
              </label>
              <small>Enable Safe Mode to block write operations</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.runtime.maintenanceMode}
                  onChange={(e) => handleInputChange('runtime', { maintenanceMode: e.target.checked })}
                />
                Maintenance Mode
              </label>
              <small>Enable maintenance mode to show maintenance page</small>
            </div>

            <div className="form-group">
              <label htmlFor="logLevel">Log Level</label>
              <select
                id="logLevel"
                value={formData.runtime.logLevel}
                onChange={(e) => handleInputChange('runtime', { logLevel: e.target.value })}
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              <small>Minimum log level to record</small>
            </div>

            <div className="form-group">
              <label htmlFor="rateLimitRPS">Rate Limit (RPS)</label>
              <input
                type="number"
                id="rateLimitRPS"
                value={formData.runtime.rateLimitRPS}
                onChange={(e) => handleInputChange('runtime', { rateLimitRPS: parseInt(e.target.value) })}
                min="1"
                max="1000"
              />
              <small>Requests per second limit (1-1000)</small>
            </div>
          </div>
        </div>


        {/* Action Buttons */}
        <div className="config-actions">
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button 
            type="button" 
            className="btn btn-danger"
            onClick={handleReset}
            disabled={saving}
          >
            Reset to Defaults
          </button>
        </div>

      </div>
    </div>
  );
}

export default Configuration;
