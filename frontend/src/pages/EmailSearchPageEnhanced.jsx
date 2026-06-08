import React, { useState, useRef, useEffect } from 'react';

const EmailSearchPageEnhanced = () => {
  const [emailInput, setEmailInput] = useState('');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
    risky: 0,
    unknown: 0,
    duplicates: 0,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const [filterText, setFilterText] = useState('');
  const [processingMode, setProcessingMode] = useState(null);
  const [stats, setStats] = useState({
    totalProcessed: 0,
    averageTime: 0,
    lastRun: null
  });

  // Parse emails from text input
  const parseEmails = (text) => {
    if (!text.trim()) return [];
    
    return text
      .split(/[,\n\r;]/)
      .map(email => email.trim())
      .filter(email => email.length > 0)
      .map(email => email.toLowerCase())
      .filter((email, index, arr) => arr.indexOf(email) === index); // Remove duplicates
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const fileEmails = parseEmails(content);
      const currentEmails = parseEmails(emailInput);
      const combinedEmails = [...new Set([...currentEmails, ...fileEmails])];
      setEmailInput(combinedEmails.join('\n'));
    };
    reader.readAsText(file);
  };

  // Run email check using final endpoint
  const runEmailCheck = async (safeMode = false) => {
    const emails = parseEmails(emailInput);
    if (emails.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(0);
    setProgressText('Starting validation...');
    setProcessingMode(safeMode ? 'Safe Mode' : 'Full Mode');

    try {
      const startTime = Date.now();
      // Use the final endpoint with comprehensive validation
      const response = await fetch('http://localhost:5003/api/email-checker-final/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails, safeMode })
      });
      
      const data = await response.json();
      const endTime = Date.now();
      
      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }
      
      setResults(data.data.results || []);
      setSummary(data.data.summary || {});
      setProgress(100);
      setProgressText('Validation completed');
      
      // Update stats
      setStats(prev => ({
        totalProcessed: prev.totalProcessed + emails.length,
        averageTime: Math.round((endTime - startTime) / emails.length),
        lastRun: new Date().toLocaleString()
      }));
      
      setSuccess(`Successfully validated ${emails.length} emails in ${Math.round(endTime - startTime)}ms`);
    } catch (err) {
      console.error('Email check error:', err);
      setError(err.message || 'Failed to validate emails');
      setProgress(0);
      setProgressText('');
    } finally {
      setLoading(false);
    }
  };

  // Download results as CSV
  const downloadCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'Email', 'Status', 'Reason', 'Domain', 'Has MX', 'Catch All', 
      'Disposable', 'Blacklisted', 'Role Based', 'Provider Sensitive',
      'Method', 'Start TLS', 'MX Host', 'Confidence', 'Checked At'
    ];

    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.email,
        result.status,
        result.reason,
        result.domain || '',
        result.hasMX,
        result.catchAll,
        result.disposable,
        result.blacklisted,
        result.roleBased,
        result.providerSensitive,
        result.method,
        result.startTLS,
        result.mxHost || '',
        result.confidence,
        result.checkedAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-validation-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.85) return 'green';
    if (confidence >= 0.5) return 'yellow';
    return 'red';
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'valid': return 'green';
      case 'invalid': return 'red';
      case 'risky': return 'orange';
      case 'unknown': return 'gray';
      default: return 'gray';
    }
  };

  // Filter results
  const filteredResults = results.filter(result =>
    result.email.toLowerCase().includes(filterText.toLowerCase()) ||
    result.status.toLowerCase().includes(filterText.toLowerCase()) ||
    result.reason.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="email-search-page">
      <div className="container">
        <div className="header">
          <h1>Email Verification Tool</h1>
          <p>Comprehensive email validation with conservative rules</p>
        </div>

        {/* Input Section */}
        <div className="input-section">
          <div className="input-group">
            <label htmlFor="emailInput">Email Addresses</label>
            <textarea
              id="emailInput"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter email addresses (one per line or comma-separated)"
              rows={6}
            />
            <small>Enter multiple emails separated by commas, semicolons, or new lines</small>
          </div>

          <div className="file-upload">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.csv"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
            >
              Upload File (.txt or .csv)
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            onClick={() => runEmailCheck(false)}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading && processingMode === 'Full Mode' ? 'Validating...' : 'Full Search'}
          </button>
          <button
            onClick={() => runEmailCheck(true)}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading && processingMode === 'Safe Mode' ? 'Validating...' : 'Safe Mode Search'}
          </button>
          {results.length > 0 && (
            <button
              onClick={downloadCSV}
              className="btn btn-success"
            >
              Download CSV
            </button>
          )}
        </div>

        {/* Progress */}
        {loading && (
          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="progress-text">{progressText}</p>
          </div>
        )}

        {/* Messages */}
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

        {/* Summary */}
        {summary.total > 0 && (
          <div className="summary-section">
            <h2>Summary</h2>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Total:</span>
                <span className="value">{summary.total}</span>
              </div>
              <div className="summary-item valid">
                <span className="label">Valid:</span>
                <span className="value">{summary.valid}</span>
              </div>
              <div className="summary-item invalid">
                <span className="label">Invalid:</span>
                <span className="value">{summary.invalid}</span>
              </div>
              <div className="summary-item risky">
                <span className="label">Risky:</span>
                <span className="value">{summary.risky}</span>
              </div>
              <div className="summary-item unknown">
                <span className="label">Unknown:</span>
                <span className="value">{summary.unknown}</span>
              </div>
              {summary.duplicates > 0 && (
                <div className="summary-item duplicates">
                  <span className="label">Duplicates:</span>
                  <span className="value">{summary.duplicates}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h2>Results</h2>
              <div className="filter-group">
                <input
                  type="text"
                  placeholder="Filter results..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>

            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Domain</th>
                    <th>Flags</th>
                    <th>Method</th>
                    <th>Confidence</th>
                    <th>MX Host</th>
                    <th>Checked At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result, index) => (
                    <tr key={index}>
                      <td className="email-cell">{result.email}</td>
                      <td>
                        <span 
                          className={`status-badge ${getStatusColor(result.status)}`}
                        >
                          {result.status}
                        </span>
                      </td>
                      <td className="reason-cell">{result.reason}</td>
                      <td>{result.domain || '-'}</td>
                      <td className="flags-cell">
                        <div className="flags-container">
                          {result.catchAll && <span className="flag-chip flag-catchall">Catch-All</span>}
                          {result.disposable && <span className="flag-chip flag-disposable">Disposable</span>}
                          {result.blacklisted && <span className="flag-chip flag-blacklisted">Blacklisted</span>}
                          {result.roleBased && <span className="flag-chip flag-role">Role-based</span>}
                          {result.providerSensitive && <span className="flag-chip flag-provider">Sensitive</span>}
                          {result.hasMX && <span className="flag-chip flag-mx">MX</span>}
                          {result.startTLS && <span className="flag-chip flag-tls">TLS</span>}
                          {!result.catchAll && !result.disposable && !result.blacklisted && !result.roleBased && !result.providerSensitive && result.hasMX && (
                            <span className="flag-chip flag-clean">Clean</span>
                          )}
                        </div>
                      </td>
                      <td>{result.method}</td>
                      <td>
                        <span 
                          className={`confidence-badge ${getConfidenceColor(result.confidence)}`}
                        >
                          {(result.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="mx-host-cell">{result.mxHost || '-'}</td>
                      <td className="time-cell">
                        {new Date(result.checkedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats.totalProcessed > 0 && (
          <div className="stats-section">
            <h3>Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Processed:</span>
                <span className="stat-value">{stats.totalProcessed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Time:</span>
                <span className="stat-value">{stats.averageTime}ms</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Last Run:</span>
                <span className="stat-value">{stats.lastRun}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSearchPageEnhanced;
