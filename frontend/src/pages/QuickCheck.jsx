import React, { useState } from 'react';
import { emailApi } from '../api.js';

function QuickCheck() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await emailApi.checkSingle(email.trim());
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to validate email');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (isValid) => {
    return isValid ? '✅' : '❌';
  };

  const getStatusText = (isValid) => {
    return isValid ? 'Valid' : 'Invalid';
  };

  const getStatusClass = (isValid) => {
    return isValid ? 'status-valid' : 'status-invalid';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Quick Email Check</h2>
        <p>Validate a single email address with comprehensive checks including MX records and SMTP probing.</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address to validate"
              disabled={loading}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !email.trim()}
          >
            {loading ? 'Validating...' : 'Validate Email'}
          </button>
        </form>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="result-header">
              <h3>Validation Result</h3>
              <div className={`status-badge ${getStatusClass(result.isValid)}`}>
                {getStatusIcon(result.isValid)} {getStatusText(result.isValid)}
              </div>
            </div>

            <div className="result-details">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Email Format:</span>
                  <span className={`detail-value ${result.formatValid ? 'valid' : 'invalid'}`}>
                    {result.formatValid ? '✅ Valid' : '❌ Invalid'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Domain Exists:</span>
                  <span className={`detail-value ${result.domainExists ? 'valid' : 'invalid'}`}>
                    {result.domainExists ? '✅ Yes' : '❌ No'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">SMTP Reachable:</span>
                  <span className={`detail-value ${result.smtpReachable ? 'valid' : 'invalid'}`}>
                    {result.smtpReachable ? '✅ Yes' : '❌ No'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Checked At:</span>
                  <span className="detail-value">
                    {new Date(result.checkedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {result.mxRecords && result.mxRecords.length > 0 && (
                <div className="mx-records">
                  <h4>MX Records</h4>
                  <div className="mx-list">
                    {result.mxRecords.map((mx, index) => (
                      <div key={index} className="mx-item">
                        <span className="mx-priority">{mx.priority}</span>
                        <span className="mx-exchange">{mx.exchange}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.smtpBanner && (
                <div className="smtp-banner">
                  <h4>SMTP Banner</h4>
                  <code className="banner-text">{result.smtpBanner}</code>
                </div>
              )}

              {result.error && (
                <div className="error-details">
                  <h4>Error Details</h4>
                  <p className="error-text">{result.error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="info-section">
        <h3>What We Check</h3>
        <div className="info-grid">
          <div className="info-item">
            <h4>📧 Email Format</h4>
            <p>Validates the email address format using RFC-compliant regex patterns.</p>
          </div>
          <div className="info-item">
            <h4>🌐 Domain Resolution</h4>
            <p>Checks if the domain exists and has valid MX (Mail Exchange) records.</p>
          </div>
          <div className="info-item">
            <h4>📡 SMTP Probing</h4>
            <p>Tests SMTP server connectivity and retrieves the server banner without sending emails.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickCheck;


















