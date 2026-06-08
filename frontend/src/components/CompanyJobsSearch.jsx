/**
 * Company Jobs Search Component with Live Trace
 * 
 * Advanced job extraction from company websites only with comprehensive tracing
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './CompanyJobsSearch.css';

const CompanyJobsSearch = () => {
  // State management
  const [isExpanded, setIsExpanded] = useState(false);
  const [country, setCountry] = useState('Saudi Arabia');
  const [cities, setCities] = useState('Riyadh,Jeddah,Dammam');
  const [domains, setDomains] = useState('stc.com\nsabic.com\naramco.com\nalmarai.com\nalrajhibank.com');
  const [keyword, setKeyword] = useState('');
  const [maxPerDomain, setMaxPerDomain] = useState(50);
  const [showTrace, setShowTrace] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  
  // Results and trace
  const [results, setResults] = useState([]);
  const [trace, setTrace] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const [logs, setLogs] = useState({});
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  
  // Trace filtering
  const [traceFilter, setTraceFilter] = useState('');
  const [showTracePanel, setShowTracePanel] = useState(false);

  // Check backend safe mode
  useEffect(() => {
    const checkBackendSafeMode = async () => {
      try {
        const response = await fetch('http://localhost:5003/api/health');
        const data = await response.json();
        setSafeMode(data.safeMode || false);
      } catch (error) {
        console.warn('Could not check backend safe mode:', error);
        setSafeMode(false);
      }
    };
    checkBackendSafeMode();
  }, []);

  // Run extraction
  const runExtraction = useCallback(async (isDryRun = false) => {
    if (safeMode) {
      alert('Safe Mode is ON - extraction is disabled.');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setTrace([]);
    setLogs({});
    setProgress({ processed: 0, total: 0 });

    try {
      const domainList = domains.split('\n').filter(d => d.trim());
      const cityList = cities.split(',').map(c => c.trim()).filter(c => c);

      const queryParams = new URLSearchParams({
        trace: showTrace ? '1' : '0',
        dry: isDryRun ? '1' : '0'
      });

      const response = await fetch(`http://localhost:5003/api/company-jobs/run?${queryParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country,
          cities: cityList,
          domains: domainList,
          keyword,
          maxPerDomain
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'SAFE_MODE_ENABLED') {
          setSafeMode(true);
          alert('Safe Mode is enabled - extraction is disabled.');
          return;
        }
        alert(`Error: ${data.error || 'Unknown error'}`);
        setLogs(prev => ({ ...prev, general: `Error: ${data.error || 'Unknown error'}` }));
        return;
      }

      setResults(data.items || []);
      setTrace(data.trace || []);
      setLogs(data.logs || {});
      setProgress({ processed: domainList.length, total: domainList.length });

    } catch (error) {
      console.error('Extraction error:', error);
      alert(`Extraction failed: ${error.message || 'Network error. Please try again.'}`);
      setLogs(prev => ({ ...prev, general: `Failed to run extraction: ${error.message}` }));
    } finally {
      setIsLoading(false);
    }
  }, [country, cities, domains, keyword, maxPerDomain, safeMode, showTrace]);

  // Clear results
  const clearResults = useCallback(() => {
    setResults([]);
    setTrace([]);
    setLogs({});
    setProgress({ processed: 0, total: 0 });
  }, []);

  // Copy all result URLs
  const copyAllUrls = useCallback(async () => {
    const urls = results.map(job => job.url).join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      alert(`Copied ${results.length} URLs to clipboard!`);
    } catch (err) {
      console.error('Failed to copy URLs:', err);
      alert('Failed to copy URLs.');
    }
  }, [results]);

  // Export results CSV
  const exportResultsCSV = useCallback(() => {
    if (results.length === 0) {
      alert('No results to export.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Company Jobs");
    XLSX.writeFile(wb, "company_jobs_results.csv");
  }, [results]);

  // Export results JSON
  const exportResultsJSON = useCallback(() => {
    if (results.length === 0) {
      alert('No results to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'company_jobs_results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  // Copy trace URLs
  const copyTraceUrls = useCallback(async () => {
    const urls = trace.map(entry => entry.url).filter(url => url && url !== '').join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      alert(`Copied ${trace.filter(entry => entry.url).length} trace URLs to clipboard!`);
    } catch (err) {
      console.error('Failed to copy trace URLs:', err);
      alert('Failed to copy trace URLs.');
    }
  }, [trace]);

  // Export trace CSV
  const exportTraceCSV = useCallback(() => {
    if (trace.length === 0) {
      alert('No trace data to export.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(trace);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Search Trace");
    XLSX.writeFile(wb, "company_jobs_trace.csv");
  }, [trace]);

  // Export trace JSON
  const exportTraceJSON = useCallback(() => {
    if (trace.length === 0) {
      alert('No trace data to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'company_jobs_trace.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [trace]);

  // Filter trace entries
  const filteredTrace = trace.filter(entry => {
    if (!traceFilter) return true;
    const searchTerm = traceFilter.toLowerCase();
    return (
      entry.domain.toLowerCase().includes(searchTerm) ||
      entry.url.toLowerCase().includes(searchTerm) ||
      entry.phase.toLowerCase().includes(searchTerm) ||
      entry.status.toLowerCase().includes(searchTerm) ||
      entry.note.toLowerCase().includes(searchTerm)
    );
  });

  // Get status color for trace entries
  const getStatusColor = (status) => {
    switch (status) {
      case 'CACHED': return 'var(--accent-3)';
      case 'FOUND': return 'var(--accent-1)';
      case 'PARSED': return 'var(--accent-2)';
      case 'ALLOWED': return 'var(--accent-3)';
      case 'ERROR': return 'var(--error)';
      case 'RATE_LIMITED': return 'var(--warning)';
      case 'DISALLOWED': return 'var(--error)';
      case 'NOT_FOUND': return 'var(--fg)';
      case 'SKIPPED': return 'var(--fg)';
      default: return 'var(--fg)';
    }
  };

  return (
    <div className="company-jobs-search card glass">
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h2>🏢 Company Jobs Search (Company Sites Only) {isExpanded ? '▼' : '►'}</h2>
        {safeMode && (
          <span className="safe-mode-badge chip chip-error">🛡️ Safe Mode ON</span>
        )}
      </div>

      {isExpanded && (
        <div className="card-content">
          {safeMode && (
            <div className="safe-mode-banner glass">
              <div className="safe-mode-content">
                <span className="safe-mode-icon">🛡️</span>
                <span>Safe Mode is ON — extraction is disabled</span>
              </div>
            </div>
          )}

          {/* Config Panel */}
          <div className="config-panel">
            <h3>⚙️ Configuration</h3>
            
            <div className="config-grid">
              <div className="input-group">
                <label htmlFor="country">Country</label>
                <input
                  type="text"
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="glass-input"
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="input-group">
                <label htmlFor="cities">Cities (comma-separated)</label>
                <input
                  type="text"
                  id="cities"
                  value={cities}
                  onChange={(e) => setCities(e.target.value)}
                  className="glass-input"
                  placeholder="Riyadh,Jeddah,Dammam"
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="input-group">
                <label htmlFor="domains">Domains (one per line)</label>
                <textarea
                  id="domains"
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  placeholder="stc.com&#10;sabic.com&#10;aramco.com"
                  rows={4}
                  className="glass-textarea"
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="input-group">
                <label htmlFor="keyword">Keyword (optional)</label>
                <input
                  type="text"
                  id="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="glass-input"
                  placeholder="engineer, manager, etc."
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="input-group">
                <label htmlFor="maxPerDomain">Max per Domain (10-200)</label>
                <input
                  type="number"
                  id="maxPerDomain"
                  value={maxPerDomain}
                  onChange={(e) => setMaxPerDomain(Math.max(10, Math.min(200, parseInt(e.target.value) || 50)))}
                  className="glass-input"
                  min="10"
                  max="200"
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="toggle-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={showTrace}
                    onChange={(e) => setShowTrace(e.target.checked)}
                    disabled={isLoading || safeMode}
                  />
                  <span className="toggle-text">Show Trace</span>
                </label>

                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    disabled={isLoading || safeMode}
                  />
                  <span className="toggle-text">Dry Run</span>
                </label>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={() => runExtraction(false)}
                disabled={isLoading || safeMode || !domains.trim()}
              >
                {isLoading ? 'Extracting...' : '🚀 Run Extract'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => runExtraction(true)}
                disabled={isLoading || safeMode || !domains.trim()}
              >
                🧪 Dry Run
              </button>
              <button
                className="btn btn-glass"
                onClick={clearResults}
                disabled={isLoading}
              >
                🗑️ Clear Results
              </button>
            </div>
          </div>

          {/* Progress */}
          {isLoading && (
            <div className="progress-section">
              <h3>⏳ Progress</h3>
              <div className="progress-bar-container glass">
                <div
                  className="progress-bar"
                  style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                ></div>
              </div>
              <p>{`Processed ${progress.processed} / ${progress.total} domains`}</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <h3>📊 Results ({results.length} jobs)</h3>
                <div className="results-actions">
                  <button className="btn btn-glass" onClick={copyAllUrls}>
                    📋 Copy URLs
                  </button>
                  <button className="btn btn-glass" onClick={exportResultsCSV}>
                    📊 Export CSV
                  </button>
                  <button className="btn btn-glass" onClick={exportResultsJSON}>
                    📄 Export JSON
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>URL</th>
                      <th>Source</th>
                      <th>Location</th>
                      <th>Country Match</th>
                      <th>City Match</th>
                      <th>Fetched At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((job, index) => (
                      <tr key={index}>
                        <td className="job-title">{job.title}</td>
                        <td className="job-url">
                          <a 
                            href={job.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="job-link"
                          >
                            {job.url}
                          </a>
                        </td>
                        <td className="job-source">{job.source}</td>
                        <td className="job-location">{job.location || 'N/A'}</td>
                        <td className="job-country-match">
                          <span className={`chip ${job.countryMatch ? 'chip-success' : 'chip-error'}`}>
                            {job.countryMatch ? '✓' : '✗'}
                          </span>
                        </td>
                        <td className="job-city-match">
                          {job.cityMatch ? (
                            <span className="chip chip-info">{job.cityMatch}</span>
                          ) : (
                            <span className="chip chip-error">✗</span>
                          )}
                        </td>
                        <td className="job-fetched-at">
                          {new Date(job.fetchedAt).toLocaleString()}
                        </td>
                        <td className="job-actions">
                          <button
                            className="btn btn-sm btn-glass"
                            onClick={() => navigator.clipboard.writeText(job.url)}
                          >
                            📋 Copy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Live Search Trace */}
          {showTrace && trace.length > 0 && (
            <div className="trace-section">
              <div className="trace-header">
                <h3>🔍 Live Search Trace ({trace.length} entries)</h3>
                <button
                  className="btn btn-glass"
                  onClick={() => setShowTracePanel(!showTracePanel)}
                >
                  {showTracePanel ? 'Hide Trace' : 'Show Trace'}
                </button>
              </div>

              {showTracePanel && (
                <div className="trace-panel">
                  <div className="trace-toolbar">
                    <input
                      type="text"
                      placeholder="Filter trace (domain, URL, phase, status, note)..."
                      value={traceFilter}
                      onChange={(e) => setTraceFilter(e.target.value)}
                      className="trace-filter-input"
                    />
                    <div className="trace-actions">
                      <button className="btn btn-sm btn-glass" onClick={copyTraceUrls}>
                        📋 Copy URLs
                      </button>
                      <button className="btn btn-sm btn-glass" onClick={exportTraceCSV}>
                        📊 Export CSV
                      </button>
                      <button className="btn btn-sm btn-glass" onClick={exportTraceJSON}>
                        📄 Export JSON
                      </button>
                    </div>
                  </div>

                  <div className="trace-table-container">
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Domain</th>
                          <th>Phase</th>
                          <th>Method</th>
                          <th>URL</th>
                          <th>Status</th>
                          <th>Duration</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrace.map((entry, index) => (
                          <tr key={index} className="trace-row">
                            <td className="trace-time">{entry.time}</td>
                            <td className="trace-domain">{entry.domain}</td>
                            <td className="trace-phase">
                              <span className="chip chip-info">{entry.phase}</span>
                            </td>
                            <td className="trace-method">{entry.method}</td>
                            <td className="trace-url">
                              {entry.url ? (
                                <a 
                                  href={entry.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="trace-link"
                                >
                                  {entry.url}
                                </a>
                              ) : (
                                <span className="trace-no-url">-</span>
                              )}
                            </td>
                            <td className="trace-status">
                              <span 
                                className="chip"
                                style={{ 
                                  backgroundColor: getStatusColor(entry.status),
                                  color: 'var(--bg)'
                                }}
                              >
                                {entry.status}
                              </span>
                            </td>
                            <td className="trace-duration">{entry.duration}ms</td>
                            <td className="trace-note">{entry.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {Object.keys(logs).length > 0 && (
            <div className="logs-section">
              <h3>📝 Logs</h3>
              <div className="logs-container">
                {Object.entries(logs).map(([domain, message]) => (
                  <div key={domain} className="log-entry">
                    <span className="log-domain">{domain}:</span>
                    <span className="log-message">{message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyJobsSearch;