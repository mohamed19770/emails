import React, { useState, useRef, useEffect } from 'react';
import { emailCheckerApi } from '../api.js';

const EmailSearchPage = () => {
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
      const allEmails = [...new Set([...currentEmails, ...fileEmails])]; // Merge and dedupe
      setEmailInput(allEmails.join('\n'));
      setSuccess(`Successfully loaded ${fileEmails.length} emails from ${file.name}`);
      setTimeout(() => setSuccess(null), 3000);
    };
    reader.readAsText(file);
  };

  // Handle email check with enhanced progress tracking
  const handleEmailCheck = async (safeMode = false) => {
    const emailList = parseEmails(emailInput);
    
    if (emailList.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    if (emailList.length > 10000) {
      setError('Maximum 10000 emails allowed per request');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResults([]);
    setSummary({
      total: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      duplicates: 0,
    });
    setProgress(0);
    setProcessingMode(safeMode ? 'Safe Mode' : 'Full Check');
    setProgressText('Initializing...');

    const startTime = Date.now();

    try {
      // Simulate chunked processing for better UX
      const chunkSize = 50;
      const chunks = [];
      for (let i = 0; i < emailList.length; i += chunkSize) {
        chunks.push(emailList.slice(i, i + chunkSize));
      }

      let allResults = [];
      let processedCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setProgressText(`Processing chunk ${i + 1} of ${chunks.length} (${processedCount}/${emailList.length} emails)...`);
        
        const response = await emailCheckerApi.runChecks(chunk, safeMode);
        
        if (response.success) {
          allResults = [...allResults, ...response.data.results];
          setResults([...allResults]);
          
          // Update summary
          const newSummary = {
            total: allResults.length,
            valid: allResults.filter(r => r.status === 'valid').length,
            invalid: allResults.filter(r => r.status === 'invalid').length,
            risky: allResults.filter(r => r.status === 'risky').length,
            unknown: allResults.filter(r => r.status === 'unknown').length,
            duplicates: response.data.summary.duplicates,
          };
          setSummary(newSummary);
          
          processedCount += chunk.length;
          setProgress(Math.round((processedCount / emailList.length) * 100));
        } else {
          throw new Error(response.error || 'Email check failed');
        }
      }

      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      // Update stats
      setStats(prev => ({
        totalProcessed: prev.totalProcessed + emailList.length,
        averageTime: prev.averageTime > 0 ? (prev.averageTime + processingTime) / 2 : processingTime,
        lastRun: new Date().toISOString()
      }));

      setProgress(100);
      setProgressText('Completed!');
      setSuccess(`Successfully processed ${emailList.length} emails in ${processingTime.toFixed(2)}s`);
      
      setTimeout(() => {
        setSuccess(null);
        setProgressText('');
      }, 3000);

    } catch (err) {
      setError(err.message || 'An error occurred while checking emails');
      console.error('Email check error:', err);
      setProgress(0);
      setProgressText('Failed');
    } finally {
      setLoading(false);
      setProcessingMode(null);
    }
  };

  // Download CSV with enhanced formatting
  const downloadCSV = () => {
    if (results.length === 0) {
      setError('No results to download');
      return;
    }

    const headers = ['Email', 'Status', 'Reason', 'Domain', 'Has MX', 'Disposable', 'Catch-All', 'Blacklisted', 'Role-Based', 'Method', 'Checked At'];
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        `"${result.email}"`,
        `"${result.status}"`,
        `"${result.reason}"`,
        `"${result.domain || ''}"`,
        result.hasMX ? 'Yes' : 'No',
        result.disposable ? 'Yes' : 'No',
        result.catchAll ? 'Yes' : 'No',
        result.blacklisted ? 'Yes' : 'No',
        result.roleBased ? 'Yes' : 'No',
        `"${result.method}"`,
        `"${new Date(result.checkedAt).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-check-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    setSuccess('CSV file downloaded successfully');
    setTimeout(() => setSuccess(null), 2000);
  };

  // Filter results
  const filteredResults = results.filter(result => 
    !filterText || 
    result.email.toLowerCase().includes(filterText.toLowerCase()) ||
    result.status.toLowerCase().includes(filterText.toLowerCase()) ||
    result.reason.toLowerCase().includes(filterText.toLowerCase()) ||
    (result.domain && result.domain.toLowerCase().includes(filterText.toLowerCase()))
  );

  // Get status chip class
  const getStatusChipClass = (status) => {
    switch (status) {
      case 'valid': return 'chip-valid';
      case 'invalid': return 'chip-invalid';
      case 'risky': return 'chip-risky';
      case 'unknown': return 'chip-unknown';
      default: return 'chip-unknown';
    }
  };

  return (
    <div className="email-search-page">
      <div className="container">
        <h1 className="page-title">Professional Email Checker</h1>
        <p className="page-description">
          Validate email addresses with comprehensive checks including MX records, SMTP probing, and deliverability analysis
        </p>

        {/* Input Section */}
        <div className="card input-section">
          <h2>Enter Email Addresses</h2>
          <textarea
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Paste emails here, one per line or comma-separated..."
            rows="10"
            disabled={loading}
          />
          <div className="file-upload-section">
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
              disabled={loading}
            />
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current.click()}
              disabled={loading}
            >
              📁 Upload .txt or .csv
            </button>
          </div>
          
          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={() => handleEmailCheck(false)}
              disabled={loading || emailInput.trim().length === 0}
            >
              {loading && processingMode === 'Full Check' ? (
                <>
                  <span className="loading-spinner"></span>
                  Full Check ({progress}%)
                </>
              ) : (
                '🔍 Full Check'
              )}
            </button>
            <button
              className="btn btn-warning"
              onClick={() => handleEmailCheck(true)}
              disabled={loading || emailInput.trim().length === 0}
            >
              {loading && processingMode === 'Safe Mode' ? (
                <>
                  <span className="loading-spinner"></span>
                  Safe Mode ({progress}%)
                </>
              ) : (
                '🛡️ Safe Mode Check'
              )}
            </button>
          </div>

          {/* Progress Indicator */}
          {loading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-text">{progressText}</div>
            </div>
          )}

          {/* Success/Error Messages */}
          {success && (
            <div className="success-banner">
              <span>✅ {success}</span>
              <button className="close-btn" onClick={() => setSuccess(null)}>✖</button>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <span>❌ {error}</span>
              <button className="close-btn" onClick={() => setError(null)}>✖</button>
            </div>
          )}
        </div>

        {/* Summary Section */}
        {results.length > 0 && (
          <div className="card results-section">
            <h2>Results Summary</h2>
            <div className="summary-header">
              <div className="summary-chips">
                <span className="chip">Total: {summary.total}</span>
                <span className="chip chip-valid">Valid: {summary.valid}</span>
                <span className="chip chip-invalid">Invalid: {summary.invalid}</span>
                <span className="chip chip-risky">Risky: {summary.risky}</span>
                <span className="chip chip-unknown">Unknown: {summary.unknown}</span>
                {summary.duplicates > 0 && (
                  <span className="chip chip-duplicate">Duplicates: {summary.duplicates}</span>
                )}
              </div>
              <div className="filter-download-section">
                <input
                  type="text"
                  placeholder="Filter results..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="filter-input"
                />
                <button className="btn btn-secondary" onClick={downloadCSV}>
                  📥 Download CSV
                </button>
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
                    <th>Checked At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result, index) => (
                    <tr key={index}>
                      <td className="email-cell">{result.email}</td>
                      <td className="status-cell">
                        <span className={`chip ${getStatusChipClass(result.status)}`}>
                          {result.status}
                        </span>
                      </td>
                      <td className="reason-cell">{result.reason}</td>
                      <td className="domain-cell">{result.domain || 'N/A'}</td>
                      <td className="flags-cell">
                        <div className="flags-container">
                          {result.disposable && (
                            <span className="flag-chip flag-disposable" title="Disposable Email">
                              🗑️ Disposable
                            </span>
                          )}
                          {result.catchAll && (
                            <span className="flag-chip flag-catchall" title="Catch-All Domain">
                              🎯 Catch-All
                            </span>
                          )}
                          {result.blacklisted && (
                            <span className="flag-chip flag-blacklisted" title="Blacklisted Domain">
                              ⚠️ Blacklisted
                            </span>
                          )}
                          {result.roleBased && (
                            <span className="flag-chip flag-role" title="Role-Based Email">
                              👤 Role-Based
                            </span>
                          )}
                          {result.hasMX && (
                            <span className="flag-chip flag-mx" title="Has MX Records">
                              📧 MX
                            </span>
                          )}
                          {!result.disposable && !result.catchAll && !result.blacklisted && !result.roleBased && result.hasMX && (
                            <span className="flag-chip flag-clean" title="Clean Email">
                              ✅ Clean
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="method-cell">{result.method}</td>
                      <td className="time-cell">{new Date(result.checkedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Section */}
        {stats.totalProcessed > 0 && (
          <div className="card" style={{ marginTop: '2rem', textAlign: 'center' }}>
            <h3>Session Statistics</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
              <div>
                <strong>{stats.totalProcessed}</strong>
                <br />
                <small>Total Processed</small>
              </div>
              <div>
                <strong>{stats.averageTime.toFixed(2)}s</strong>
                <br />
                <small>Avg Time</small>
              </div>
              <div>
                <strong>{stats.lastRun ? new Date(stats.lastRun).toLocaleTimeString() : 'N/A'}</strong>
                <br />
                <small>Last Run</small>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSearchPage;