import React, { useState, useEffect, useCallback } from 'react';
import './IndustryDomainFinder.css';

const IndustryDomainFinder = ({ embedded = false }) => {
  // Configuration state
  const [industryKeywords, setIndustryKeywords] = useState([]);
  const [countries, setCountries] = useState(['Saudi Arabia']);
  const [biasWords, setBiasWords] = useState([]);
  const [engines, setEngines] = useState(['ddg', 'mock']);
  const [maxSerpPages, setMaxSerpPages] = useState(2);
  const [verify, setVerify] = useState({
    dns: true,
    http: true,
    ssl: true,
    mx: true
  });
  const [langBias, setLangBias] = useState('auto');
  
  // TLD preferences
  const [preferredTLDs, setPreferredTLDs] = useState(['.sa', '.com.sa', '.ae', '.qa', '.kw', '.bh', '.om', '.eg', '.com', '.net', '.org']);
  const [excludedTLDs, setExcludedTLDs] = useState([]);
  const [topN, setTopN] = useState(10);
  
  // UI state
  const [keywordInput, setKeywordInput] = useState('');
  const [countryInput, setCountryInput] = useState('');
  const [biasInput, setBiasInput] = useState('');
  const [tldInput, setTldInput] = useState('');
  const [excludeTldInput, setExcludeTldInput] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showKeywordPresets, setShowKeywordPresets] = useState(false);
  
  // Results and search state
  const [results, setResults] = useState([]);
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(null);
  const [sortBy, setSortBy] = useState('score');
  
  // Built-in countries
  const builtInCountries = [
    { code: 'SA', name: 'Saudi Arabia', nameAr: 'السعودية' },
    { code: 'AE', name: 'United Arab Emirates', nameAr: 'الإمارات' },
    { code: 'QA', name: 'Qatar', nameAr: 'قطر' },
    { code: 'KW', name: 'Kuwait', nameAr: 'الكويت' },
    { code: 'BH', name: 'Bahrain', nameAr: 'البحرين' },
    { code: 'OM', name: 'Oman', nameAr: 'عمان' },
    { code: 'EG', name: 'Egypt', nameAr: 'مصر' },
    { code: 'JO', name: 'Jordan', nameAr: 'الأردن' },
    { code: 'LB', name: 'Lebanon', nameAr: 'لبنان' }
  ];
  
  // Industry keyword presets
  const industryPresets = {
    'Technology': ['software', 'tech', 'IT', 'programming', 'development', 'engineering'],
    'Healthcare': ['medical', 'healthcare', 'hospital', 'clinic', 'pharmacy', 'medical center'],
    'Finance': ['bank', 'financial', 'investment', 'insurance', 'finance', 'credit'],
    'Education': ['university', 'college', 'school', 'education', 'academy', 'institute'],
    'Government': ['government', 'ministry', 'department', 'authority', 'agency', 'bureau'],
    'Retail': ['retail', 'shopping', 'store', 'market', 'commerce', 'trade'],
    'Arabic Generic': ['شركة', 'مؤسسة', 'مجموعة', 'هيئة', 'مركز', 'مكتب']
  };
  
  // Load saved presets from localStorage
  const [savedPresets, setSavedPresets] = useState(() => {
    const saved = localStorage.getItem('industryFinder.keywordPresets');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('industryFinder.config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setIndustryKeywords(config.industryKeywords || []);
      setCountries(config.countries || ['Saudi Arabia']);
      setBiasWords(config.biasWords || []);
      setEngines(config.engines || ['ddg', 'mock']);
      setMaxSerpPages(config.maxSerpPages || 2);
      setVerify(config.verify || { dns: true, http: true, ssl: true, mx: true });
      setLangBias(config.langBias || 'auto');
      setPreferredTLDs(config.preferredTLDs || ['.sa', '.com.sa', '.ae', '.qa', '.kw', '.bh', '.om', '.eg', '.com', '.net', '.org']);
      setExcludedTLDs(config.excludedTLDs || []);
      setTopN(config.topN || 10);
    }
  }, []);
  
  // Save config to localStorage
  const saveConfig = useCallback(() => {
    const config = {
      industryKeywords,
      countries,
      biasWords,
      engines,
      maxSerpPages,
      verify,
      langBias,
      preferredTLDs,
      excludedTLDs,
      topN
    };
    localStorage.setItem('industryFinder.config', JSON.stringify(config));
  }, [industryKeywords, countries, biasWords, engines, maxSerpPages, verify, langBias, preferredTLDs, excludedTLDs, topN]);
  
  // Utility functions
  const getTLD = (hostname) => {
    if (!hostname) return '';
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return '.' + parts.slice(-2).join('.');
    }
    return '.' + parts[parts.length - 1];
  };
  
  const isPreferred = (tld) => {
    return preferredTLDs.includes(tld);
  };
  
  const isExcluded = (tld) => {
    return excludedTLDs.includes(tld);
  };
  
  const groupByIndustry = (rows) => {
    const groups = new Map();
    rows.forEach(row => {
      const industry = row.industryKeyword || 'Unknown';
      if (!groups.has(industry)) {
        groups.set(industry, []);
      }
      groups.get(industry).push(row);
    });
    return groups;
  };
  
  const sortResults = (results) => {
    return results.sort((a, b) => {
      const aTld = getTLD(a.domain);
      const bTld = getTLD(b.domain);
      const aPreferred = isPreferred(aTld);
      const bPreferred = isPreferred(bTld);
      
      // 1) Preferred TLD bucket first
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      
      // 2) Score desc
      if (a.score !== b.score) return b.score - a.score;
      
      // 3) HTTP 200 desc
      if (a.signals?.http200 !== b.signals?.http200) return (b.signals?.http200 ? 1 : 0) - (a.signals?.http200 ? 1 : 0);
      
      // 4) SSL OK desc
      if (a.signals?.sslOk !== b.signals?.sslOk) return (b.signals?.sslOk ? 1 : 0) - (a.signals?.sslOk ? 1 : 0);
      
      // 5) MX OK desc
      if (a.signals?.mxOk !== b.signals?.mxOk) return (b.signals?.mxOk ? 1 : 0) - (a.signals?.mxOk ? 1 : 0);
      
      // 6) Domain A-Z
      return a.domain.localeCompare(b.domain);
    });
  };
  
  const exportTopN = (groups, n) => {
    const exportData = [];
    groups.forEach((rows, industry) => {
      const sortedRows = sortResults(rows);
      const topRows = sortedRows.slice(0, n);
      exportData.push(...topRows.map(row => ({
        industryKeyword: industry,
        domain: row.domain,
        score: row.score,
        status: row.status,
        signals: row.signals,
        evidence: row.evidence,
        fetchedAt: row.fetchedAt
      })));
    });
    return exportData;
  };
  
  const downloadBlob = (name, mime, blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Keyword management
  const addKeyword = (keyword) => {
    if (keyword.trim() && !industryKeywords.includes(keyword.trim())) {
      setIndustryKeywords([...industryKeywords, keyword.trim()]);
      setKeywordInput('');
    }
  };
  
  const removeKeyword = (keyword) => {
    setIndustryKeywords(industryKeywords.filter(k => k !== keyword));
  };
  
  const addKeywordFromPreset = (presetName) => {
    const preset = industryPresets[presetName] || savedPresets[presetName];
    if (preset) {
      const newKeywords = [...new Set([...industryKeywords, ...preset])];
      setIndustryKeywords(newKeywords);
    }
    setShowKeywordPresets(false);
  };
  
  const saveKeywordPreset = () => {
    const name = prompt('Enter preset name:');
    if (name && industryKeywords.length > 0) {
      const newPresets = { ...savedPresets, [name]: industryKeywords };
      setSavedPresets(newPresets);
      localStorage.setItem('industryFinder.keywordPresets', JSON.stringify(newPresets));
    }
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
  
  const addBuiltInCountry = (country) => {
    if (!countries.includes(country.name)) {
      setCountries([...countries, country.name]);
    }
    setShowCountryDropdown(false);
  };
  
  // Bias words management
  const addBiasWord = (word) => {
    if (word.trim() && !biasWords.includes(word.trim())) {
      setBiasWords([...biasWords, word.trim()]);
      setBiasInput('');
    }
  };
  
  const removeBiasWord = (word) => {
    setBiasWords(biasWords.filter(w => w !== word));
  };
  
  // TLD management
  const addPreferredTLD = (tld) => {
    const normalizedTld = tld.startsWith('.') ? tld : '.' + tld;
    if (normalizedTld && !preferredTLDs.includes(normalizedTld)) {
      setPreferredTLDs([...preferredTLDs, normalizedTld]);
      setTldInput('');
    }
  };
  
  const removePreferredTLD = (tld) => {
    setPreferredTLDs(preferredTLDs.filter(t => t !== tld));
  };
  
  const addExcludedTLD = (tld) => {
    const normalizedTld = tld.startsWith('.') ? tld : '.' + tld;
    if (normalizedTld && !excludedTLDs.includes(normalizedTld)) {
      setExcludedTLDs([...excludedTLDs, normalizedTld]);
      setExcludeTldInput('');
    }
  };
  
  const removeExcludedTLD = (tld) => {
    setExcludedTLDs(excludedTLDs.filter(t => t !== tld));
  };
  
  // Run search
  const runSearch = async (dryRun = false) => {
    if (industryKeywords.length === 0) {
      alert('Please add at least one industry keyword.');
      return;
    }
    
    if (countries.length === 0) {
      alert('Please select at least one country.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(`/api/industry-domains/run?dry=${dryRun ? 1 : 0}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industryKeywords,
          countries,
          biasWords: biasWords.length > 0 ? biasWords : undefined,
          engines,
          maxSerpPages,
          verify,
          langBias,
          preferredTLDs: preferredTLDs.length > 0 ? preferredTLDs : undefined,
          excludedTLDs: excludedTLDs.length > 0 ? excludedTLDs : undefined
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is ok and has content
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText}`);
      }
      
      // Check if response has JSON content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Expected JSON response but got: ${contentType}. Response: ${responseText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(`Invalid JSON response: ${jsonError.message}. This usually means the server response was interrupted or corrupted.`);
      }
      
      if (!data.success) {
        alert(`Error: ${data.error || 'Unknown error'}`);
        return;
      }
      
      if (dryRun) {
        // console.log('Dry run results:', data.queries); // Removed for cleaner console
        alert(`Dry run completed. Would execute ${data.queries?.length || 0} queries.`);
        return;
      }
      
      setRunId(data.runId);
      setResults(data.results || []);
      setExamples(data.examples || []);
      saveConfig();
      
      // Show success message with verification details
      if (data.summary) {
        const { verifiedDomains, exampleDomains, verificationSuccessRate } = data.summary;
        let message = `Search completed! Found ${verifiedDomains} verified domains`;
        
        if (exampleDomains > 0) {
          message += ` and detected ${exampleDomains} example/mock domains (flagged separately)`;
        }
        
        if (verificationSuccessRate > 0) {
          message += `. Verification success rate: ${verificationSuccessRate}%`;
        }
        
        alert(message);
      } else if (data.results && data.results.length > 0) {
        alert(`Search completed! Found ${data.results.length} verified domains.`);
      } else {
        alert('Search completed but no verified domains were found. Try adjusting your keywords or search parameters.');
      }
      
    } catch (error) {
      console.error('Search error:', error);
      
      if (error.name === 'AbortError') {
        alert('Search request timed out. Please try again with fewer keywords or pages.');
      } else if (error.message.includes('JSON')) {
        alert(`Search failed: ${error.message}`);
      } else {
        alert(`Search failed: ${error.message || 'Network error. Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Export functions
  const exportTopNCSV = () => {
    const groups = groupByIndustry(results);
    const exportData = exportTopN(groups, topN);
    
    if (exportData.length === 0) {
      alert('No results to export.');
      return;
    }
    
    const headers = ['industryKeyword', 'domain', 'status', 'countryMatch', 'score', 'signals.http200', 'signals.sslOk', 'signals.mxOk', 'evidence.lang', 'domainAgeDays', 'sslValidTo'];
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => {
        const value = header.split('.').reduce((obj, key) => obj?.[key], row) || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `industry-top${topN}-${timestamp}.csv`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    downloadBlob(filename, 'text/csv', blob);
    
    // Show toast
    const toast = document.createElement('div');
    toast.textContent = `Exported Top ${topN} per industry (N=${topN})`;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--bg-glass);padding:12px;border-radius:8px;z-index:1000;';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  };
  
  const exportTopNJSON = () => {
    const groups = groupByIndustry(results);
    const exportData = exportTopN(groups, topN);
    
    if (exportData.length === 0) {
      alert('No results to export.');
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `industry-top${topN}-${timestamp}.json`;
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadBlob(filename, 'application/json', blob);
    
    // Show toast
    const toast = document.createElement('div');
    toast.textContent = `Exported Top ${topN} per industry (N=${topN})`;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--bg-glass);padding:12px;border-radius:8px;z-index:1000;';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  };
  
  // Filter and sort results
  const filteredResults = results.filter(row => {
    const tld = getTLD(row.domain);
    return !isExcluded(tld);
  });
  
  const sortedResults = sortResults(filteredResults);
  
  return (
    <div className={`industry-domain-finder ${embedded ? 'embedded' : ''}`}>
      <div className="glass">
        {!embedded && (
          <div className="section-header">
            <h2>🏢 Industry Domain Finder</h2>
            <p>Discover industry-specific domains with TLD preferences and export capabilities</p>
          </div>
        )}
        
        {/* Configuration Panel */}
        <div className="config-panel">
          {/* Industry Keywords */}
          <div className="config-section">
            <label className="section-label">Industry Keywords</label>
            <div className="chips-container">
              {industryKeywords.map(keyword => (
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
                onKeyPress={(e) => e.key === 'Enter' && addKeyword(keywordInput)}
                placeholder="Enter industry keyword and press Enter"
                className="focus-ring"
                aria-label="Industry Keywords"
              />
              <button onClick={() => addKeyword(keywordInput)} className="btn-glass btn-small">
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
            </div>
            {showKeywordPresets && (
              <div className="preset-dropdown">
                <div className="preset-section">
                  <div className="preset-header">Built-in Presets</div>
                  {Object.keys(industryPresets).map(preset => (
                    <button
                      key={preset}
                      onClick={() => addKeywordFromPreset(preset)}
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
                        onClick={() => addKeywordFromPreset(preset)}
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
          
          {/* Countries */}
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
                  aria-label="Countries"
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
                      onClick={() => addCountry(countryInput)}
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
          
          {/* Bias Words */}
          <div className="config-section">
            <label className="section-label">Bias Words (optional)</label>
            <div className="chips-container">
              {biasWords.map(word => (
                <span key={word} className="chip chip-bias">
                  {word}
                  <button onClick={() => removeBiasWord(word)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <input
                type="text"
                value={biasInput}
                onChange={(e) => setBiasInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addBiasWord(biasInput)}
                placeholder="Enter bias word and press Enter"
                className="focus-ring"
                aria-label="Bias Words"
              />
              <button onClick={() => addBiasWord(biasInput)} className="btn-glass btn-small">
                Add
              </button>
            </div>
          </div>
          
          {/* TLD Preferences */}
          <div className="config-section">
            <label className="section-label">Preferred TLDs</label>
            <div className="chips-container">
              {preferredTLDs.map(tld => (
                <span key={tld} className="chip chip-tld chip-preferred">
                  {tld}
                  <button onClick={() => removePreferredTLD(tld)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <input
                type="text"
                value={tldInput}
                onChange={(e) => setTldInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPreferredTLD(tldInput)}
                placeholder="Enter TLD (e.g., .sa, .com.sa)"
                className="focus-ring"
                aria-label="Preferred TLDs"
              />
              <button onClick={() => addPreferredTLD(tldInput)} className="btn-glass btn-small">
                Add
              </button>
            </div>
          </div>
          
          {/* Excluded TLDs */}
          <div className="config-section">
            <label className="section-label">Excluded TLDs (optional)</label>
            <div className="chips-container">
              {excludedTLDs.map(tld => (
                <span key={tld} className="chip chip-tld chip-excluded">
                  {tld}
                  <button onClick={() => removeExcludedTLD(tld)} className="chip-remove">×</button>
                </span>
              ))}
            </div>
            <div className="input-row">
              <input
                type="text"
                value={excludeTldInput}
                onChange={(e) => setExcludeTldInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addExcludedTLD(excludeTldInput)}
                placeholder="Enter TLD to exclude (e.g., .ru, .cn)"
                className="focus-ring"
                aria-label="Excluded TLDs"
              />
              <button onClick={() => addExcludedTLD(excludeTldInput)} className="btn-glass btn-small">
                Add
              </button>
            </div>
          </div>
          
          {/* Export Settings */}
          <div className="config-section">
            <label className="section-label">Export Settings</label>
            <div className="settings-row">
              <div className="setting-item">
                <label htmlFor="topN">Top N per Industry</label>
                <input
                  id="topN"
                  type="number"
                  min="1"
                  max="200"
                  value={topN}
                  onChange={(e) => setTopN(Math.min(200, Math.max(1, parseInt(e.target.value) || 10)))}
                  className="focus-ring"
                  aria-label="Top N"
                />
              </div>
              <div className="setting-item">
                <label htmlFor="sortBy">Sort by</label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="focus-ring"
                >
                  <option value="score">Score</option>
                  <option value="domain">Domain</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => runSearch(true)}
              disabled={loading || industryKeywords.length === 0 || countries.length === 0}
              className="btn-glass btn-secondary"
            >
              🔍 Dry Run
            </button>
            <button
              onClick={() => runSearch(false)}
              disabled={loading || industryKeywords.length === 0 || countries.length === 0}
              className="btn-glass btn-primary"
            >
              🚀 Run Search
            </button>
            <button
              onClick={exportTopNCSV}
              disabled={results.length === 0}
              className="btn-glass btn-secondary"
            >
              📊 Export Top N (CSV)
            </button>
            <button
              onClick={exportTopNJSON}
              disabled={results.length === 0}
              className="btn-glass btn-secondary"
            >
              📈 Export Top N (JSON)
            </button>
          </div>
        </div>
        
        {/* Results */}
        {sortedResults.length > 0 && (
          <div className="results-panel">
            <div className="results-header">
              <h3>📋 Results ({sortedResults.length})</h3>
              <div className="results-stats">
                <span className="chip">Preferred TLDs: {preferredTLDs.length}</span>
                <span className="chip">Excluded TLDs: {excludedTLDs.length}</span>
                <span className="chip">Top N: {topN}</span>
              </div>
            </div>
            
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Industry</th>
                    <th>Domain</th>
                    <th>TLD</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>HTTP 200</th>
                    <th>SSL OK</th>
                    <th>MX OK</th>
                    <th>Language</th>
                    <th>Age (days)</th>
                    <th>SSL Valid To</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((row, index) => {
                    const tld = getTLD(row.domain);
                    const isPreferredTld = isPreferred(tld);
                    return (
                      <tr key={index} className={isPreferredTld ? 'preferred-tld' : ''}>
                        <td>{row.industryKeyword || 'Unknown'}</td>
                        <td className="domain-cell">{row.domain}</td>
                        <td>
                          <span className={`chip chip-tld ${isPreferredTld ? 'chip-preferred' : ''}`}>
                            {tld}
                          </span>
                        </td>
                        <td>
                          <span className={`status status-${row.status?.toLowerCase() || 'unknown'}`}>
                            {row.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="score-cell">{row.score || 0}</td>
                        <td>{row.signals?.http200 ? '✓' : '✗'}</td>
                        <td>{row.signals?.sslOk ? '✓' : '✗'}</td>
                        <td>{row.signals?.mxOk ? '✓' : '✗'}</td>
                        <td>{row.evidence?.lang || 'Unknown'}</td>
                        <td>{row.domainAgeDays || 'Unknown'}</td>
                        <td>{row.sslValidTo || 'Unknown'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Searching industry domains...</p>
          </div>
        )}
        
        {/* Examples Section */}
        {examples.length > 0 && (
          <div className="results-panel">
            <div className="results-header">
              <h3>⚠️ Examples (Unverified) ({examples.length})</h3>
              <div className="results-stats">
                <span className="chip warning">Mock/Example Domains Detected</span>
              </div>
            </div>
            
            <div className="warning-banner">
              <p>
                <strong>Notice:</strong> These domains appear to be example/mock entries (e.g., example.com, test.com). 
                They have been flagged and separated from verified results. Only verified, active company domains are shown above.
              </p>
            </div>
            
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Reason</th>
                    <th>Industry</th>
                    <th>Country</th>
                    <th>Engine</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((example, index) => (
                    <tr key={index} className="example-row">
                      <td>
                        <a href={example.url} target="_blank" rel="noopener noreferrer">
                          {example.domain}
                        </a>
                      </td>
                      <td>
                        <span className="badge warning">{example.exampleReason}</span>
                      </td>
                      <td>{example.industry}</td>
                      <td>{example.country}</td>
                      <td>{example.engine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndustryDomainFinder;

