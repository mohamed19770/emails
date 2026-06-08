import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './EnhancedSearchEngine.css';

const EnhancedSearchEngine = () => {
  // Configuration state
  const [keywords, setKeywords] = useState([]);
  const [countries, setCountries] = useState(['Saudi Arabia']);
  const [locations, setLocations] = useState([]);
  const [prefixes, setPrefixes] = useState([]);
  const [selectedEngines, setSelectedEngines] = useState(['ddg', 'mock']);
  const [maxPages, setMaxPages] = useState(5);
  const [extractEmails, setExtractEmails] = useState(true);
  
  // UI state
  const [keywordInput, setKeywordInput] = useState('');
  const [countryInput, setCountryInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [prefixInput, setPrefixInput] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showKeywordPresets, setShowKeywordPresets] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  
  // Results and trace state
  const [results, setResults] = useState([]);
  const [emails, setEmails] = useState([]);
  const [trace, setTrace] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [activeTab, setActiveTab] = useState('jobs');
  
  // Safe Mode state
  const [safeMode, setSafeMode] = useState(false);
  
  // Filters
  const [textFilter, setTextFilter] = useState('');
  const [engineFilter, setEngineFilter] = useState([]);
  const [domainFilter, setDomainFilter] = useState([]);

  // Available engines
  const availableEngines = {
    ddg: { name: 'DuckDuckGo HTML', description: 'Organic job postings from DuckDuckGo' },
    mock: { name: 'Mock Engine (Testing)', description: 'Static test data for offline testing' }
  };

  // Built-in countries list
  const builtInCountries = [
    { code: 'SA', name: 'Saudi Arabia', nameAr: 'السعودية', synonyms: ['Saudi', 'KSA', 'Saudi Arabia', 'السعودية'] },
    { code: 'AE', name: 'United Arab Emirates', nameAr: 'الإمارات', synonyms: ['UAE', 'United Arab Emirates', 'الإمارات'] },
    { code: 'QA', name: 'Qatar', nameAr: 'قطر', synonyms: ['Qatar', 'قطر'] },
    { code: 'KW', name: 'Kuwait', nameAr: 'الكويت', synonyms: ['Kuwait', 'الكويت'] },
    { code: 'BH', name: 'Bahrain', nameAr: 'البحرين', synonyms: ['Bahrain', 'البحرين'] },
    { code: 'OM', name: 'Oman', nameAr: 'عمان', synonyms: ['Oman', 'عمان'] },
    { code: 'EG', name: 'Egypt', nameAr: 'مصر', synonyms: ['Egypt', 'مصر'] },
    { code: 'JO', name: 'Jordan', nameAr: 'الأردن', synonyms: ['Jordan', 'الأردن'] },
    { code: 'LB', name: 'Lebanon', nameAr: 'لبنان', synonyms: ['Lebanon', 'لبنان'] }
  ];

  // Keyword presets
  const keywordPresets = {
    'HR Hiring': ['HR', 'recruitment', 'hiring', 'وظائف', 'توظيف', 'الموارد البشرية'],
    'Tech Hiring': ['engineer', 'developer', 'programmer', 'مهندس', 'مبرمج', 'تطوير'],
    'Medical Hiring': ['doctor', 'nurse', 'medical', 'طبيب', 'ممرض', 'طبي'],
    'Arabic Generic': ['وظائف', 'توظيف', 'عمل', 'شغل', 'مهندس', 'طبيب', 'موظف']
  };

  // Load saved presets from localStorage
  const [savedPresets, setSavedPresets] = useState(() => {
    const saved = localStorage.getItem('keywordPresets');
    return saved ? JSON.parse(saved) : {};
  });

  // Load last config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('searchConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setKeywords(config.keywords || []);
      setCountries(config.countries || ['Saudi Arabia']);
      setLocations(config.locations || []);
      setPrefixes(config.prefixes || []);
      setSelectedEngines(config.engines || ['ddg', 'mock']);
      setMaxPages(config.maxPages || 5);
      setExtractEmails(config.extractEmails !== false);
    }
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback(() => {
    const config = {
      keywords,
      countries,
      locations,
      prefixes,
      engines: selectedEngines,
      maxPages,
      extractEmails
    };
    localStorage.setItem('searchConfig', JSON.stringify(config));
  }, [keywords, countries, locations, prefixes, selectedEngines, maxPages, extractEmails]);

  // Keyword management
  const addKeyword = (keyword) => {
    if (keyword.trim() && !keywords.includes(keyword.trim())) {
      const newKeywords = [...keywords, keyword.trim()];
      setKeywords(newKeywords);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const addKeywordFromInput = () => {
    if (keywordInput.trim()) {
      addKeyword(keywordInput.trim());
    }
  };

  const addKeywordsFromPreset = (presetName) => {
    const preset = keywordPresets[presetName] || savedPresets[presetName];
    if (preset) {
      const newKeywords = [...new Set([...keywords, ...preset])];
      setKeywords(newKeywords);
    }
    setShowKeywordPresets(false);
  };

  const saveKeywordPreset = () => {
    const name = prompt('Enter preset name:');
    if (name && keywords.length > 0) {
      const newPresets = { ...savedPresets, [name]: keywords };
      setSavedPresets(newPresets);
      localStorage.setItem('keywordPresets', JSON.stringify(newPresets));
    }
  };

  const clearKeywords = () => {
    setKeywords([]);
  };

  // Country management
  const addCountry = (country) => {
    if (country.trim() && !countries.includes(country.trim())) {
      setCountries([...countries, country.trim()]);
      setCountryInput('');
    }
  };

  const removeCountry = (country) => {
    setCountries(countries.filter(c => c !== country));
  };

  const addCountryFromInput = () => {
    if (countryInput.trim()) {
      addCountry(countryInput.trim());
    }
  };

  const addBuiltInCountry = (country) => {
    if (!countries.includes(country.name)) {
      setCountries([...countries, country.name]);
    }
    setShowCountryDropdown(false);
  };

  // Location management
  const addLocation = (location) => {
    if (location.trim() && !locations.includes(location.trim())) {
      setLocations([...locations, location.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (location) => {
    setLocations(locations.filter(l => l !== location));
  };

  const addLocationFromInput = () => {
    if (locationInput.trim()) {
      addLocation(locationInput.trim());
    }
  };

  // Prefix management
  const addPrefix = (prefix) => {
    if (prefix.trim() && !prefixes.includes(prefix.trim())) {
      setPrefixes([...prefixes, prefix.trim()]);
      setPrefixInput('');
    }
  };

  const removePrefix = (prefix) => {
    setPrefixes(prefixes.filter(p => p !== prefix));
  };

  const addPrefixFromInput = () => {
    if (prefixInput.trim()) {
      addPrefix(prefixInput.trim());
    }
  };

  // Engine management
  const toggleEngine = (engineId) => {
    setSelectedEngines(prev => 
      prev.includes(engineId) 
        ? prev.filter(id => id !== engineId)
        : [...prev, engineId]
    );
  };

  // Run search
  const runSearch = useCallback(async (dryRun = false) => {
    if (safeMode) {
      alert('Safe Mode is ON - search is disabled.');
      return;
    }

    if (selectedEngines.length === 0) {
      alert('Please select at least one search engine.');
      return;
    }

    if (keywords.length === 0) {
      alert('Please add at least one keyword.');
      return;
    }

    if (countries.length === 0) {
      alert('Please select at least one country.');
      return;
    }

    setLoading(true);
    setSafeMode(false);

    try {
      const keywordList = keywords;
      const locationList = locations;

      const queryParams = new URLSearchParams({
        trace: '1',
        dry: dryRun ? '1' : '0'
      });

      const response = await fetch(`http://localhost:5003/api/enhanced-search/run?${queryParams}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordList,
          countries: countries,
          locations: locationList.length > 0 ? locationList : undefined,
          prefixes: prefixes.length > 0 ? prefixes : undefined,
          engines: selectedEngines,
          maxPages,
          extractEmails
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(`Error: ${data.error || 'Unknown error'}`);
        setTrace([]);
        return;
      }

      // Convert results to expected format
      const jobs = data.data?.jobs || [];
      const extractedEmails = data.data?.emails || [];
      
      const convertedResults = jobs.map(job => {
        let domain = 'unknown';
        try {
          if (job.url) {
            domain = new URL(job.url).hostname;
          }
        } catch (e) {
          console.warn('Invalid URL:', job.url);
        }
        
        return {
          title: job.title || 'No title',
          url: job.url || '',
          domain: domain,
          snippet: `${job.title || 'No title'} at ${job.source || 'Unknown source'} - ${job.location || 'Unknown location'}`,
          engine: (job.source || 'unknown').toLowerCase(),
          matchedKeywords: job.matchedKeywords || [],
          fetchedAt: job.fetchedAt
        };
      });

      const convertedEmails = extractedEmails.map(email => ({
        email: email.email || '',
        domain: email.domain || '',
        title: email.title || 'No title',
        sourceUrl: email.sourceUrl || '',
        engine: email.engine || 'unknown',
        snippet: email.snippet || '',
        fetchedAt: email.fetchedAt || new Date().toISOString()
      }));

      setResults(convertedResults);
      setEmails(convertedEmails);
      
      setTrace([{
        ts: new Date().toISOString(),
        time: new Date().toLocaleTimeString(),
        engine: 'enhanced-search',
        query: `${keywordList.join(' ')} in ${countries.join(', ')}`,
        status: 'OK',
        count: convertedResults.length,
        durationMs: 0,
        note: `Found ${convertedResults.length} jobs and ${convertedEmails.length} emails from ${data.data?.source || 'All'} sources`
      }]);
      
      setShowTrace(true);
      saveConfig();

    } catch (error) {
      console.error('Search error:', error);
      alert('Failed to run search. Check console for details.');
    } finally {
      setLoading(false);
    }
  }, [keywords, countries, locations, prefixes, selectedEngines, maxPages, extractEmails, safeMode, saveConfig]);

  // Export functions
  const exportCSV = (data, filename) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllUrls = () => {
    const urls = results.map(item => item.url).join('\n');
    navigator.clipboard.writeText(urls);
  };

  const copyAllEmails = () => {
    const emails = results.map(email => email.email).join('\n');
    navigator.clipboard.writeText(emails);
  };

  const clearResults = () => {
    setResults([]);
    setEmails([]);
    setTrace([]);
    setShowTrace(false);
  };

  return (
    <div className="enhanced-search-engine">
      <div className="glass">
        <div className="section-header">
          <h2>🔍 Enhanced Search Engine</h2>
          <p>Multi-country search with dynamic keywords and email extraction</p>
        </div>

        {safeMode && (
          <div className="safe-mode-banner">
            <div className="safe-mode-content">
              <span className="safe-mode-icon">🛡️</span>
              <span className="safe-mode-text">Safe Mode is enabled. Search operations are blocked.</span>
            </div>
          </div>
        )}

        {/* Config Panel */}
        <div className="config-panel">
          {/* Countries Section */}
          <div className="config-section">
            <label className="section-label">Countries</label>
            <div className="chips-container">
              {countries.map(country => (
                <span key={country} className="chip chip-country">
                  {country}
                  <button onClick={() => removeCountry(country)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <div className="dropdown-container">
                <input
                  type="text"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  onFocus={() => setShowCountryDropdown(true)}
                  placeholder="Add custom country or select from list"
                  className="focus-ring"
                />
                {showCountryDropdown && (
                  <div className="dropdown">
                    <div className="dropdown-header">Built-in Countries</div>
                    {builtInCountries.map(country => (
                      <button
                        key={country.code}
                        onClick={() => addBuiltInCountry(country)}
                        className="dropdown-item"
                        disabled={countries.includes(country.name)}
                      >
                        {country.name} ({country.nameAr})
                      </button>
                    ))}
                    <div className="dropdown-divider"></div>
                    <button
                      onClick={addCountryFromInput}
                      className="dropdown-item"
                      disabled={!countryInput.trim()}
                    >
                      Add Custom: "{countryInput}"
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Keywords Section */}
          <div className="config-section">
            <label className="section-label">Keywords</label>
            <div className="chips-container">
              {keywords.map(keyword => (
                <span key={keyword} className="chip chip-keyword">
                  {keyword}
                  <button onClick={() => removeKeyword(keyword)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeywordFromInput()}
                placeholder="Enter keyword and press Enter"
                className="focus-ring"
              />
              <button onClick={addKeywordFromInput} className="btn-glass btn-small">
                Add
              </button>
            </div>
            <div className="preset-controls">
              <button
                onClick={() => setShowKeywordPresets(!showKeywordPresets)}
                className="btn-glass btn-small"
              >
                Add from Preset
              </button>
              <button onClick={saveKeywordPreset} className="btn-glass btn-small">
                Save Preset
              </button>
              <button onClick={clearKeywords} className="btn-glass btn-small">
                Clear All
              </button>
            </div>
            {showKeywordPresets && (
              <div className="preset-dropdown">
                <div className="preset-section">
                  <div className="preset-header">Built-in Presets</div>
                  {Object.keys(keywordPresets).map(preset => (
                    <button
                      key={preset}
                      onClick={() => addKeywordsFromPreset(preset)}
                      className="preset-item"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {Object.keys(savedPresets).length > 0 && (
                  <div className="preset-section">
                    <div className="preset-header">Saved Presets</div>
                    {Object.keys(savedPresets).map(preset => (
                      <button
                        key={preset}
                        onClick={() => addKeywordsFromPreset(preset)}
                        className="preset-item"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Locations Section */}
          <div className="config-section">
            <label className="section-label">Locations (optional)</label>
            <div className="chips-container">
              {locations.map(location => (
                <span key={location} className="chip chip-location">
                  {location}
                  <button onClick={() => removeLocation(location)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addLocationFromInput()}
                placeholder="Riyadh, Jeddah, Dubai, جدة, الرياض"
                className="focus-ring"
              />
              <button onClick={addLocationFromInput} className="btn-glass btn-small">
                Add
              </button>
            </div>
          </div>

          {/* Prefixes Section */}
          <div className="config-section">
            <label className="section-label">Email Prefixes (optional)</label>
            <div className="chips-container">
              {prefixes.map(prefix => (
                <span key={prefix} className="chip chip-prefix">
                  {prefix}
                  <button onClick={() => removePrefix(prefix)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <input
                type="text"
                value={prefixInput}
                onChange={(e) => setPrefixInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPrefixFromInput()}
                placeholder="hr@, jobs@, careers@"
                className="focus-ring"
              />
              <button onClick={addPrefixFromInput} className="btn-glass btn-small">
                Add
              </button>
            </div>
          </div>

          {/* Engines Section */}
          <div className="config-section">
            <label className="section-label">Search Engines</label>
            <div className="checkbox-group">
              {Object.entries(availableEngines).map(([id, engine]) => (
                <label key={id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedEngines.includes(id)}
                    onChange={() => toggleEngine(id)}
                  />
                  <span className="checkbox-text">{engine.name}</span>
                  <span className="checkbox-description">{engine.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Settings Section */}
          <div className="config-section">
            <div className="settings-row">
              <div className="setting-item">
                <label htmlFor="maxPages">Max Pages per Engine</label>
                <input
                  id="maxPages"
                  type="number"
                  min="1"
                  max="10"
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value))}
                  className="focus-ring"
                />
              </div>
              <div className="setting-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={extractEmails}
                    onChange={(e) => setExtractEmails(e.target.checked)}
                  />
                  <span className="checkbox-text">Extract Company Emails</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => runSearch(true)}
              disabled={loading || safeMode || keywords.length === 0 || countries.length === 0}
              className="btn-glass btn-secondary"
            >
              🔍 Dry Run
            </button>
            <button
              onClick={() => runSearch(false)}
              disabled={loading || safeMode || keywords.length === 0 || countries.length === 0}
              className="btn-glass btn-primary"
            >
              🚀 Run Search
            </button>
            <button
              onClick={clearResults}
              className="btn-glass btn-warning"
            >
              🗑️ Clear
            </button>
            <button
              onClick={() => exportCSV(results, 'enhanced-search-results.csv')}
              disabled={results.length === 0}
              className="btn-glass btn-secondary"
            >
              📊 Export CSV
            </button>
            <button
              onClick={() => exportJSON(results, 'enhanced-search-results.json')}
              disabled={results.length === 0}
              className="btn-glass btn-secondary"
            >
              📈 Export JSON
            </button>
          </div>
        </div>

        {/* Trace Panel */}
        {trace.length > 0 && (
          <div className="trace-panel">
            <div className="trace-header">
              <h3>📊 Live Trace ({trace.length} entries)</h3>
              <button
                onClick={() => setShowTrace(!showTrace)}
                className="btn-glass btn-small"
              >
                {showTrace ? 'Hide' : 'Show'} Trace
              </button>
            </div>

            {showTrace && (
              <div className="trace-content">
                <div className="trace-table-container">
                  <table className="trace-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Engine</th>
                        <th>Query</th>
                        <th>Status</th>
                        <th>Count</th>
                        <th>Duration (ms)</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trace.map((entry, index) => (
                        <tr key={index}>
                          <td>{entry.time}</td>
                          <td>
                            <span className={`chip chip-${entry.engine}`}>
                              {entry.engine}
                            </span>
                          </td>
                          <td>{entry.query}</td>
                          <td>
                            <span className={`status status-${entry.status.toLowerCase()}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td>{entry.count}</td>
                          <td>{entry.durationMs}</td>
                          <td>{entry.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {(results.length > 0 || emails.length > 0) && (
          <div className="results-panel">
            <div className="results-header">
              <h3>📋 Results</h3>
              <div className="results-tabs">
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`tab-button ${activeTab === 'jobs' ? 'active' : ''}`}
                >
                  Jobs View ({results.length})
                </button>
                <button
                  onClick={() => setActiveTab('emails')}
                  className={`tab-button ${activeTab === 'emails' ? 'active' : ''}`}
                >
                  Company Emails ({emails.length})
                </button>
              </div>
            </div>

            {activeTab === 'jobs' && (
              <div className="jobs-view">
                <div className="view-actions">
                  <button
                    onClick={copyAllUrls}
                    className="btn-glass btn-small"
                  >
                    📋 Copy All URLs
                  </button>
                  <button
                    onClick={() => exportCSV(results, 'jobs-results.csv')}
                    className="btn-glass btn-small"
                  >
                    📊 Export CSV
                  </button>
                  <button
                    onClick={() => exportJSON(results, 'jobs-results.json')}
                    className="btn-glass btn-small"
                  >
                    📈 Export JSON
                  </button>
                </div>

                <div className="results-table-container">
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
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((item, index) => (
                        <tr key={index}>
                          <td className="title-cell">{item.title}</td>
                          <td>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="url-link"
                            >
                              {item.url}
                            </a>
                          </td>
                          <td>{item.domain}</td>
                          <td>
                            <span className={`chip chip-${item.engine}`}>
                              {item.engine}
                            </span>
                          </td>
                          <td className="snippet-cell">{item.snippet}</td>
                          <td>
                            <div className="keywords-list">
                              {item.matchedKeywords?.map((keyword, i) => (
                                <span key={i} className="keyword-chip">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>{new Date(item.fetchedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'emails' && (
              <div className="emails-view">
                <div className="view-actions">
                  <button
                    onClick={copyAllEmails}
                    className="btn-glass btn-small"
                  >
                    📋 Copy All Emails
                  </button>
                  <button
                    onClick={() => exportCSV(emails, 'emails-results.csv')}
                    className="btn-glass btn-small"
                  >
                    📊 Export CSV
                  </button>
                  <button
                    onClick={() => exportJSON(emails, 'emails-results.json')}
                    className="btn-glass btn-small"
                  >
                    📈 Export JSON
                  </button>
                </div>

                <div className="results-table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Domain</th>
                        <th>Page Title</th>
                        <th>Source URL</th>
                        <th>Engine</th>
                        <th>Snippet</th>
                        <th>Fetched At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emails.map((email, index) => (
                        <tr key={index}>
                          <td className="email-cell">
                            <a
                              href={`mailto:${email.email}`}
                              className="email-link"
                            >
                              {email.email}
                            </a>
                          </td>
                          <td>{email.domain}</td>
                          <td className="title-cell">{email.title}</td>
                          <td>
                            <a
                              href={email.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="url-link"
                            >
                              {email.sourceUrl}
                            </a>
                          </td>
                          <td>
                            <span className={`chip chip-${email.engine}`}>
                              {email.engine}
                            </span>
                          </td>
                          <td className="snippet-cell">{email.snippet}</td>
                          <td>{new Date(email.fetchedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Searching...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedSearchEngine;
