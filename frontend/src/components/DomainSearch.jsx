/**
 * Domain-Scoped Job Search Component with Search Engines
 * 
 * Advanced job search across multiple search engines with domain scoping
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './DomainSearch.css';

const DomainSearch = () => {
  // State management
  const [isExpanded, setIsExpanded] = useState(false);
  const [domains, setDomains] = useState('stc.com\nsabic.com\naramco.com\nalmarai.com\nalrajhibank.com');
  const [keywords, setKeywords] = useState('موظف, مهندس, طبيب, engineer, developer');
  const [locations, setLocations] = useState('Saudi Arabia, Riyadh, Jeddah, جدة, الرياض');
  const [maxPerQuery, setMaxPerQuery] = useState(20);
  const [showTrace, setShowTrace] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  
  // Engine management
  const [availableEngines, setAvailableEngines] = useState([]);
  const [selectedEngines, setSelectedEngines] = useState([]);
  const [engineOrder, setEngineOrder] = useState(['bing', 'google_cse', 'brave', 'ddg']);
  
  // Results and trace
  const [results, setResults] = useState([]);
  const [trace, setTrace] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  
  // Filters
  const [textFilter, setTextFilter] = useState('');
  const [engineFilter, setEngineFilter] = useState([]);
  const [domainFilter, setDomainFilter] = useState([]);
  const [showTracePanel, setShowTracePanel] = useState(false);

  // Load saved engine configuration
  useEffect(() => {
    const savedEngines = localStorage.getItem('domainSearchEngines');
    const savedOrder = localStorage.getItem('domainSearchOrder');
    
    if (savedEngines) {
      try {
        setSelectedEngines(JSON.parse(savedEngines));
      } catch (e) {
        console.warn('Failed to load saved engines:', e);
      }
    }
    
    if (savedOrder) {
      try {
        setEngineOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.warn('Failed to load saved engine order:', e);
      }
    }
  }, []);

  // Save engine configuration
  useEffect(() => {
    localStorage.setItem('domainSearchEngines', JSON.stringify(selectedEngines));
  }, [selectedEngines]);

  useEffect(() => {
    localStorage.setItem('domainSearchOrder', JSON.stringify(engineOrder));
  }, [engineOrder]);

  // Check backend safe mode and load engines
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const [healthResponse, enginesResponse] = await Promise.all([
          fetch('http://localhost:5003/api/health'),
          fetch('http://localhost:5003/api/domain-search/engines')
        ]);
        
        const healthData = await healthResponse.json();
        const enginesData = await enginesResponse.json();
        
        setSafeMode(healthData.safeMode || false);
        setAvailableEngines(enginesData.engines || []);
      } catch (error) {
        console.warn('Could not check backend status:', error);
        setSafeMode(false);
      }
    };
    checkBackendStatus();
  }, []);

  // Move engine up in priority
  const moveEngineUp = useCallback((engineId) => {
    setEngineOrder(prev => {
      const newOrder = [...prev];
      const index = newOrder.indexOf(engineId);
      if (index > 0) {
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      }
      return newOrder;
    });
  }, []);

  // Move engine down in priority
  const moveEngineDown = useCallback((engineId) => {
    setEngineOrder(prev => {
      const newOrder = [...prev];
      const index = newOrder.indexOf(engineId);
      if (index < newOrder.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      }
      return newOrder;
    });
  }, []);

  // Toggle engine selection
  const toggleEngine = useCallback((engineId) => {
    setSelectedEngines(prev => {
      if (prev.includes(engineId)) {
        return prev.filter(id => id !== engineId);
      } else {
        return [...prev, engineId];
      }
    });
  }, []);

  // Run search
  const runSearch = useCallback(async (isDryRun = false) => {
    if (safeMode) {
      alert('Safe Mode is ON - search is disabled.');
      return;
    }

    if (selectedEngines.length === 0) {
      alert('Please select at least one search engine.');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setTrace([]);
    setProgress({ processed: 0, total: 0 });

    try {
      const domainList = domains.split('\n').filter(d => d.trim());
      const keywordList = keywords.split(/[,\s]+/).filter(k => k.trim());
      const locationList = locations.split(',').map(l => l.trim()).filter(l => l);

      const queryParams = new URLSearchParams({
        trace: showTrace ? '1' : '0',
        dry: isDryRun ? '1' : '0'
      });

      const response = await fetch(`http://localhost:5003/api/domain-search/run?${queryParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: domainList,
          keywords: keywordList,
          locations: locationList,
          engines: engineOrder.filter(engineId => selectedEngines.includes(engineId)),
          maxPerQuery
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'SAFE_MODE_ENABLED') {
          setSafeMode(true);
          alert('Safe Mode is enabled - search is disabled.');
          return;
        }
        alert(`Error: ${data.error || 'Unknown error'}`);
        return;
      }

      setResults(data.items || []);
      setTrace(data.trace || []);
      setProgress({ processed: data.count || 0, total: domainList.length });

    } catch (error) {
      console.error('Search error:', error);
      alert(`Search failed: ${error.message || 'Network error. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [domains, keywords, locations, selectedEngines, engineOrder, maxPerQuery, safeMode, showTrace]);

  // Clear results
  const clearResults = useCallback(() => {
    setResults([]);
    setTrace([]);
    setProgress({ processed: 0, total: 0 });
  }, []);

  // Import domains from file
  const importDomains = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const importedDomains = content.split('\n').filter(d => d.trim());
        const currentDomains = domains.split('\n').filter(d => d.trim());
        const mergedDomains = [...new Set([...currentDomains, ...importedDomains])];
        setDomains(mergedDomains.join('\n'));
      };
      reader.readAsText(file);
    }
  }, [domains]);

  // Export configuration
  const exportConfig = useCallback(() => {
    const config = {
      domains: domains.split('\n').filter(d => d.trim()),
      keywords: keywords.split(/[,\s]+/).filter(k => k.trim()),
      locations: locations.split(',').map(l => l.trim()).filter(l => l),
      maxPerQuery,
      selectedEngines,
      engineOrder
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domain_search_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [domains, keywords, locations, maxPerQuery, selectedEngines, engineOrder]);

  // Copy all result URLs
  const copyAllUrls = useCallback(async () => {
    const urls = results.map(item => item.url).join('\n');
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
    XLSX.utils.book_append_sheet(wb, ws, "Domain Search Results");
    XLSX.writeFile(wb, "domain_search_results.csv");
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
    a.download = 'domain_search_results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  // Copy trace query URLs
  const copyTraceUrls = useCallback(async () => {
    const urls = trace.map(entry => entry.query).filter(query => query && query !== '').join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      alert(`Copied ${trace.filter(entry => entry.query).length} query URLs to clipboard!`);
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
    XLSX.writeFile(wb, "domain_search_trace.csv");
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
    a.download = 'domain_search_trace.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [trace]);

  // Filter results
  const filteredResults = results.filter(item => {
    // Text filter
    if (textFilter) {
      const searchText = `${item.title} ${item.snippet} ${item.url}`.toLowerCase();
      if (!searchText.includes(textFilter.toLowerCase())) {
        return false;
      }
    }

    // Engine filter
    if (engineFilter.length > 0 && !engineFilter.includes(item.engine)) {
      return false;
    }

    // Domain filter
    if (domainFilter.length > 0) {
      const itemDomain = item.url ? new URL(item.url).hostname : '';
      if (!domainFilter.some(domain => itemDomain.includes(domain))) {
        return false;
      }
    }

    return true;
  });

  // Get unique domains and engines for filters
  const uniqueDomains = [...new Set(results.map(item => {
    try {
      return new URL(item.url).hostname;
    } catch {
      return '';
    }
  }).filter(domain => domain))];

  const uniqueEngines = [...new Set(results.map(item => item.engine))];

  // Get status color for trace entries
  const getStatusColor = (status) => {
    switch (status) {
      case 'OK': return 'var(--accent-3)';
      case 'CACHED': return 'var(--accent-1)';
      case 'DRY_RUN': return 'var(--accent-2)';
      case 'ERROR': return 'var(--error)';
      case 'RATE_LIMITED': return 'var(--warning)';
      case 'SKIPPED': return 'var(--fg)';
      default: return 'var(--fg)';
    }
  };

  return (
    <div className="domain-search card glass">
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h2>🔍 Domain-Scoped Job Search (Search Engines) {isExpanded ? '▼' : '►'}</h2>
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
                <span>Safe Mode is ON — search is disabled</span>
              </div>
            </div>
          )}

          {/* Config Panel */}
          <div className="config-panel">
            <h3>⚙️ Configuration</h3>
            
            <div className="config-grid">
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
                <label htmlFor="keywords">Keywords (comma/space separated)</label>
                <input
                  type="text"
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="glass-input"
                  placeholder="موظف, مهندس, طبيب, engineer, developer"
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="input-group">
                <label htmlFor="locations">Locations (optional, comma separated)</label>
                <input
                  type="text"
                  id="locations"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  className="glass-input"
                  placeholder="Saudi Arabia, Riyadh, Jeddah, جدة, الرياض"
                  disabled={isLoading || safeMode}
                />
              </div>

              <div className="input-group">
                <label htmlFor="maxPerQuery">Max Results per Query (5-50)</label>
                <input
                  type="number"
                  id="maxPerQuery"
                  value={maxPerQuery}
                  onChange={(e) => setMaxPerQuery(Math.max(5, Math.min(50, parseInt(e.target.value) || 20)))}
                  className="glass-input"
                  min="5"
                  max="50"
                  disabled={isLoading || safeMode}
                />
              </div>
            </div>

            {/* Engine Selector with Reorder */}
            <div className="engines-section">
              <h4>🔧 Search Engines (Drag to Reorder Priority)</h4>
              <div className="engines-list">
                {engineOrder.map((engineId, index) => {
                  const engine = availableEngines.find(e => e.id === engineId);
                  if (!engine) return null;
                  
                  return (
                    <div key={engineId} className="engine-item">
                      <div className="engine-controls">
                        <button
                          className="btn btn-sm btn-glass"
                          onClick={() => moveEngineUp(engineId)}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn-sm btn-glass"
                          onClick={() => moveEngineDown(engineId)}
                          disabled={index === engineOrder.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                      
                      <div className="engine-info">
                        <label className="engine-toggle">
                          <input
                            type="checkbox"
                            checked={selectedEngines.includes(engineId)}
                            onChange={() => toggleEngine(engineId)}
                            disabled={isLoading || safeMode}
                          />
                          <span className="engine-name">{engine.name}</span>
                          <span className="engine-priority">#{index + 1}</span>
                        </label>
                        <div className="engine-status">
                          {engine.configured ? (
                            <span className="chip chip-success">✓ Configured</span>
                          ) : (
                            <span className="chip chip-error">✗ Not Configured</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={() => runSearch(false)}
                disabled={isLoading || safeMode || selectedEngines.length === 0}
              >
                {isLoading ? 'Searching...' : '🔍 Run Search'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => runSearch(true)}
                disabled={isLoading || safeMode || selectedEngines.length === 0}
              >
                🧪 Dry Run
              </button>
              <button
                className="btn btn-glass"
                onClick={clearResults}
                disabled={isLoading}
              >
                🗑️ Clear
              </button>
              <button
                className="btn btn-glass"
                onClick={exportConfig}
                disabled={isLoading}
              >
                ⬇️ Export Config
              </button>
              <label htmlFor="import-domains" className="btn btn-glass">
                ⬆️ Import Domains
                <input
                  type="file"
                  id="import-domains"
                  accept=".txt"
                  onChange={importDomains}
                  style={{ display: 'none' }}
                  disabled={isLoading || safeMode}
                />
              </label>
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
              <p>{`Processed ${progress.processed} / ${progress.total} queries`}</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <h3>📊 Results ({filteredResults.length} of {results.length})</h3>
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

              {/* Filters */}
              <div className="filters-section">
                <div className="filter-group">
                  <input
                    type="text"
                    placeholder="Filter by text..."
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <select
                    multiple
                    value={engineFilter}
                    onChange={(e) => setEngineFilter(Array.from(e.target.selectedOptions, option => option.value))}
                    className="filter-select"
                  >
                    {uniqueEngines.map(engine => (
                      <option key={engine} value={engine}>{engine}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <select
                    multiple
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(Array.from(e.target.selectedOptions, option => option.value))}
                    className="filter-select"
                  >
                    {uniqueDomains.map(domain => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>URL</th>
                      <th>Domain</th>
                      <th>Engine</th>
                      <th>Snippet</th>
                      <th>Matched Keywords</th>
                      <th>Fetched At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((item, index) => (
                      <tr key={index}>
                        <td className="result-title">{item.title}</td>
                        <td className="result-url">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="result-link"
                          >
                            {item.url}
                          </a>
                        </td>
                        <td className="result-domain">
                          {item.url ? new URL(item.url).hostname : 'N/A'}
                        </td>
                        <td className="result-engine">
                          <span className="chip chip-info">{item.engine}</span>
                        </td>
                        <td className="result-snippet">{item.snippet}</td>
                        <td className="result-keywords">
                          {item.matchedKeywords ? (
                            <div className="keywords-list">
                              {item.matchedKeywords.map((keyword, i) => (
                                <span key={i} className="chip chip-success">{keyword}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="chip chip-error">None</span>
                          )}
                        </td>
                        <td className="result-fetched-at">
                          {new Date(item.fetchedAt).toLocaleString()}
                        </td>
                        <td className="result-actions">
                          <button
                            className="btn btn-sm btn-glass"
                            onClick={() => navigator.clipboard.writeText(item.url)}
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
                    <div className="trace-actions">
                      <button className="btn btn-sm btn-glass" onClick={copyTraceUrls}>
                        📋 Copy Query URLs
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
                          <th>Engine</th>
                          <th>Priority</th>
                          <th>Query</th>
                          <th>Status</th>
                          <th>Count</th>
                          <th>Duration</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trace.map((entry, index) => (
                          <tr key={index} className="trace-row">
                            <td className="trace-time">{entry.time}</td>
                            <td className="trace-engine">{entry.engine}</td>
                            <td className="trace-priority">#{entry.priority}</td>
                            <td className="trace-query">
                              <a 
                                href={entry.query} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="trace-link"
                              >
                                {entry.query}
                              </a>
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
                            <td className="trace-count">{entry.count}</td>
                            <td className="trace-duration">{entry.durationMs}ms</td>
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
        </div>
      )}
    </div>
  );
};

export default DomainSearch;
