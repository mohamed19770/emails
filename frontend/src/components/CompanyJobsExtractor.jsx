import React, { useState, useEffect, useCallback } from 'react';
import './CompanyJobsExtractor.css';

const CompanyJobsExtractor = () => {
  // State management
  const [isExpanded, setIsExpanded] = useState(false);
  const [country, setCountry] = useState('Saudi Arabia');
  const [cities, setCities] = useState('');
  const [domains, setDomains] = useState('');
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [results, setResults] = useState(null);
  const [safeMode, setSafeMode] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

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
  const runExtraction = useCallback(async (dryRun = false) => {
    if (!domains.trim()) {
      alert('Please enter at least one domain');
      return;
    }

    setIsLoading(true);
    setIsDryRun(dryRun);

    try {
      const domainList = domains.split('\n').filter(d => d.trim());
      const cityList = cities.split(',').map(c => c.trim()).filter(c => c);

      const response = await fetch('http://localhost:5003/api/company-jobs/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country,
          cities: cityList,
          domains: domainList,
          keyword: keyword.trim()
        })
      });

      const data = await response.json();

      if (data.ok) {
        setResults(data);
      } else {
        if (data.error === 'SAFE_MODE_ENABLED') {
          alert('Company jobs extraction is disabled in Safe Mode');
        } else {
          alert(`Error: ${data.message || data.error}`);
        }
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract jobs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [country, cities, domains, keyword]);

  // Dry run (first domain only)
  const runDryRun = useCallback(() => {
    runExtraction(true);
  }, [runExtraction]);

  // Clear results
  const clearResults = useCallback(() => {
    setResults(null);
    setSearchFilter('');
  }, []);

  // Copy all URLs
  const copyAllUrls = useCallback(async () => {
    if (!results?.items) return;

    const urls = results.items.map(item => item.url).join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      alert('All URLs copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URLs:', err);
      alert('Failed to copy URLs.');
    }
  }, [results]);

  // Export CSV
  const exportCSV = useCallback(() => {
    if (!results?.items) return;

    const headers = ['Title', 'URL', 'Source', 'Location', 'Country Match', 'City Match', 'Fetched At'];
    const csvContent = [
      headers.join(','),
      ...results.items.map(item => [
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.url}"`,
        `"${item.source}"`,
        `"${item.location}"`,
        `"${item.countryMatch ? 'Yes' : 'No'}"`,
        `"${item.cityMatch || 'N/A'}"`,
        `"${new Date(item.fetchedAt).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-jobs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  // Export JSON
  const exportJSON = useCallback(() => {
    if (!results?.items) return;

    const jsonContent = JSON.stringify(results, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-jobs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  // Filter results
  const filteredResults = results?.items?.filter(item => {
    if (!searchFilter) return true;
    const filter = searchFilter.toLowerCase();
    return item.title.toLowerCase().includes(filter) || 
           item.location.toLowerCase().includes(filter);
  }) || [];

  return (
    <div className="company-jobs-extractor">
      {/* Header */}
      <div className="extractor-header glass">
        <div className="extractor-title">
          <h3>🏢 Company Jobs Extractor</h3>
          <button
            className="btn btn-glass toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
        
        {safeMode && (
          <div className="safe-mode-banner glass">
            <span className="safe-mode-icon">🛡️</span>
            <span>Safe Mode is ON — Company jobs extraction is disabled</span>
          </div>
        )}
      </div>

      {/* Config Panel */}
      {isExpanded && (
        <div className="extractor-config glass">
          <div className="config-grid">
            <div className="config-group">
              <label htmlFor="country">Country</label>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="config-input"
                placeholder="Saudi Arabia"
              />
            </div>

            <div className="config-group">
              <label htmlFor="cities">Cities (comma-separated)</label>
              <input
                id="cities"
                type="text"
                value={cities}
                onChange={(e) => setCities(e.target.value)}
                className="config-input"
                placeholder="Riyadh,Jeddah,Dammam"
              />
            </div>

            <div className="config-group full-width">
              <label htmlFor="domains">Domains (one per line)</label>
              <textarea
                id="domains"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className="config-textarea"
                placeholder="stc.com&#10;sabic.com&#10;aramco.com"
                rows="4"
              />
            </div>

            <div className="config-group">
              <label htmlFor="keyword">Keyword (optional)</label>
              <input
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="config-input"
                placeholder="engineer"
              />
            </div>
          </div>

          <div className="config-actions">
            <button
              className="btn btn-primary"
              onClick={() => runExtraction(false)}
              disabled={isLoading || safeMode}
            >
              {isLoading ? '⏳ Extracting...' : '🚀 Run Extract'}
            </button>
            
            <button
              className="btn btn-secondary"
              onClick={runDryRun}
              disabled={isLoading || safeMode}
            >
              {isLoading && isDryRun ? '⏳ Testing...' : '🧪 Dry Run'}
            </button>
            
            <button
              className="btn btn-glass"
              onClick={clearResults}
              disabled={!results}
            >
              🗑️ Clear Results
            </button>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {results && (
        <div className="extractor-results glass">
          {/* Summary */}
          <div className="results-summary">
            <div className="summary-chips">
              <span className="chip chip-primary">
                📊 Total: {results.count}
              </span>
              <span className="chip chip-success">
                🌍 Country Matches: {results.items?.filter(item => item.countryMatch).length || 0}
              </span>
              <span className="chip chip-info">
                🏙️ City Matches: {results.items?.filter(item => item.cityMatch).length || 0}
              </span>
              <span className="chip chip-warning">
                🔗 Unique Domains: {new Set(results.items?.map(item => item.source) || []).size}
              </span>
            </div>
          </div>

          {/* Search Filter */}
          <div className="results-filter">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="filter-input"
              placeholder="🔍 Filter by title or location..."
            />
          </div>

          {/* Results Table */}
          <div className="results-table-container">
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
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item, index) => (
                  <tr key={index}>
                    <td className="job-title-cell">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="job-link"
                      >
                        {item.title}
                      </a>
                    </td>
                    <td className="job-url-cell">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="url-link"
                      >
                        🔗
                      </a>
                    </td>
                    <td className="job-source-cell">
                      <span className="source-badge">
                        {item.source}
                      </span>
                    </td>
                    <td className="job-location-cell">
                      {item.location}
                    </td>
                    <td className="job-country-cell">
                      <span className={`match-badge ${item.countryMatch ? 'match-yes' : 'match-no'}`}>
                        {item.countryMatch ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="job-city-cell">
                      {item.cityMatch || 'N/A'}
                    </td>
                    <td className="job-time-cell">
                      {new Date(item.fetchedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export Actions */}
          <div className="results-actions">
            <button
              className="btn btn-glass"
              onClick={copyAllUrls}
              disabled={!results?.items?.length}
            >
              📋 Copy All URLs
            </button>
            
            <button
              className="btn btn-glass"
              onClick={exportCSV}
              disabled={!results?.items?.length}
            >
              📊 Export CSV
            </button>
            
            <button
              className="btn btn-glass"
              onClick={exportJSON}
              disabled={!results?.items?.length}
            >
              📄 Export JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyJobsExtractor;
