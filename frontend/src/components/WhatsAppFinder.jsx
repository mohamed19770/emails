import React, { useState, useRef, useEffect, useCallback } from 'react';
import './LiveCompanyEmailsFinder.css';

// Add inline styles for warning banner
const warningStyles = `
  .engine-selection {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .engine-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .engine-option:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .engine-option input[type="radio"] {
    margin: 0;
  }
  
  .warning-banner {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    font-weight: 600;
    border: 1px solid #d97706;
  }
  
  .success-banner {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    font-weight: 600;
    border: 1px solid #16a34a;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = warningStyles;
  document.head.appendChild(styleSheet);
}

const WhatsAppFinder = () => {
  // Phone extraction state
  const [extractPhones, setExtractPhones] = useState(true);
  const [phoneTypes, setPhoneTypes] = useState(['mobile', 'landline', 'toll-free']);
  const [maxPhonesPerDomain, setMaxPhonesPerDomain] = useState(5);
  const [maxWhatsAppPerDomain, setMaxWhatsAppPerDomain] = useState(3);
  const [strictPhoneMode, setStrictPhoneMode] = useState(false);
  
  // Basic search state
  const [keywords, setKeywords] = useState([]);
  const [countries, setCountries] = useState(['Saudi Arabia']);
  const [engines, setEngines] = useState(['ddg']); // Default to real search
  const [maxPages, setMaxPages] = useState(2);
  
  // Results state
  const [phones, setPhones] = useState([]);
  const [whatsapp, setWhatsapp] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(null);
  const [pagesVisited, setPagesVisited] = useState(0);
  const [errors, setErrors] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const eventSourceRef = useRef(null);
  
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
    { code: 'LB', name: 'Lebanon', nameAr: 'لبنان' },
    { code: 'IQ', name: 'Iraq', nameAr: 'العراق' }
  ];

  // Keyword presets
  const keywordPresets = [
    { name: 'Technology', keywords: ['software', 'technology', 'IT', 'digital', 'tech'] },
    { name: 'Healthcare', keywords: ['medical', 'healthcare', 'hospital', 'clinic', 'pharmacy'] },
    { name: 'Finance', keywords: ['bank', 'finance', 'financial', 'investment', 'insurance'] },
    { name: 'Education', keywords: ['school', 'university', 'education', 'college', 'training'] },
    { name: 'Real Estate', keywords: ['real estate', 'property', 'construction', 'building'] }
  ];

  // Run search function
  const runSearch = async (dryRun = false) => {
    if (keywords.length === 0) {
      alert('Please add at least one keyword');
      return;
    }

    if (countries.length === 0) {
      alert('Please select at least one country');
      return;
    }

    setLoading(true);
    setErrors(0);

    try {
      const response = await fetch(`/api/prefix-emails/run?dry=${dryRun ? 1 : 0}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefixes: ['contact@', 'info@', 'support@'],
          keywords,
          countries,
          locations: '',
          engines,
          maxPages,
          maxEmailsPerDomain: 3,
          exploration: { siteWide: false },
          // Phone extraction options
          extractPhones,
          phoneTypes,
          maxPhonesPerDomain,
          maxWhatsAppPerDomain,
          strictPhoneMode
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRunId(data.runId);
        if (!dryRun) {
          startStreaming(data.runId);
        } else {
          alert(`Dry run completed. Would execute ${data.queries?.length || 0} queries.`);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      alert(`Search failed: ${error.message}`);
      setLoading(false);
    }
  };

  // Start streaming results
  const startStreaming = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setLoading(true);
    setPhones([]);
    setWhatsapp([]);
    setPagesVisited(0);
    setErrors(0);
    
    const eventSource = new EventSource(`/api/prefix-emails/stream/${id}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'result':
        case 'mobile': // Handle phone results with type 'mobile'
          if (data.resultType === 'phone') {
            setPhones(prev => [...prev, {
              e164: data.e164,
              local: data.local,
              country: data.country,
              type: data.type,
              sourceUrl: data.sourceUrl,
              source: data.source,
              confidence: data.confidence,
              context: data.context,
              note: data.note,
              fetchedAt: data.fetchedAt
            }]);
          } else if (data.resultType === 'whatsapp') {
            setWhatsapp(prev => [...prev, {
              e164: data.e164,
              local: data.local,
              country: data.country,
              kind: data.kind,
              sourceUrl: data.sourceUrl,
              source: data.source,
              confidence: data.confidence,
              context: data.context,
              note: data.note,
              fetchedAt: data.fetchedAt
            }]);
          }
          break;
          
        case 'trace':
          if (data.scope === 'visit') {
            setPagesVisited(prev => prev + 1);
          }
          break;
          
        case 'done':
          setLoading(false);
          eventSource.close();
          break;
          
        case 'error':
          setErrors(prev => prev + 1);
          break;
      }
    };

    eventSource.onerror = () => {
      setLoading(false);
      eventSource.close();
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Add keyword
  const addKeyword = (keyword) => {
    if (keyword.trim() && !keywords.includes(keyword.trim())) {
      setKeywords([...keywords, keyword.trim()]);
    }
  };

  // Remove keyword
  const removeKeyword = (keyword) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  // Load preset
  const loadPreset = (preset) => {
    setKeywords(preset.keywords);
  };

  return (
    <div className="live-company-emails-finder">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">📱 WhatsApp Finder</h1>
          <p className="page-description">
            Find WhatsApp numbers and phone contacts from company websites
          </p>
        </div>

        {/* Keywords Section */}
        <div className="config-section glass">
          <h3>🔍 Search Keywords</h3>
          
          <div className="keyword-input-section">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter keywords (e.g., technology, software, medical)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addKeyword(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button 
                className="btn btn-primary"
                onClick={(e) => {
                  const input = e.target.previousElementSibling;
                  addKeyword(input.value);
                  input.value = '';
                }}
              >
                Add
              </button>
            </div>
            
            <div className="keyword-presets">
              <label>Quick Presets:</label>
              <div className="preset-buttons">
                {keywordPresets.map((preset, index) => (
                  <button
                    key={index}
                    className="btn btn-secondary"
                    onClick={() => loadPreset(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="keywords-list">
              {keywords.map((keyword, index) => (
                <span key={index} className="keyword-chip">
                  {keyword}
                  <button onClick={() => removeKeyword(keyword)}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Countries Section */}
        <div className="config-section glass">
          <h3>🌍 Target Countries</h3>
          
          <div className="countries-grid">
            {builtInCountries.map((country, index) => (
              <label key={index} className="country-option">
                <input
                  type="checkbox"
                  checked={countries.includes(country.name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCountries([...countries, country.name]);
                    } else {
                      setCountries(countries.filter(c => c !== country.name));
                    }
                  }}
                />
                <span>{country.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Search Engine Selection */}
        <div className="config-section glass">
          <h3>🔍 Search Engine</h3>
          
          <div className="engine-selection">
            <label className="engine-option">
              <input
                type="radio"
                name="engine"
                value="ddg"
                checked={engines.includes('ddg')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEngines(['ddg']);
                  }
                }}
              />
              <span>🌐 DuckDuckGo (Real Search)</span>
            </label>
            
            <label className="engine-option">
              <input
                type="radio"
                name="engine"
                value="mock"
                checked={engines.includes('mock')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEngines(['mock']);
                  }
                }}
              />
              <span>🧪 Mock Data (Test Only)</span>
            </label>
          </div>
          
          <div className="engine-warning">
            {engines.includes('mock') && (
              <div className="warning-banner">
                ⚠️ <strong>WARNING:</strong> Mock engine produces FAKE test data only! 
                <br/>All phone numbers and WhatsApp links are randomly generated for testing purposes.
                <br/>Switch to <strong>DuckDuckGo</strong> for real search results from actual websites.
              </div>
            )}
            {engines.includes('ddg') && (
              <div className="success-banner">
                ✅ <strong>Real Search Active:</strong> Using DuckDuckGo to find actual phone numbers and WhatsApp contacts from real company websites.
              </div>
            )}
          </div>
        </div>



        {/* Loading Overlay */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Searching for WhatsApp numbers...</p>
          </div>
        )}

        {/* Search Operation Panel - Moved to Bottom */}
        <div className="search-operation-panel glass">
          <h3>Search Operation</h3>
          
          <div className="live-counters">
            <div className="counter">
              <span className="counter-label">Status:</span>
              <span className={`counter-value ${loading ? 'status-running' : isPaused ? 'status-paused' : 'status-stopped'}`}>
                {loading ? '🟢 Running' : isPaused ? '🟡 Paused' : '🔴 Stopped'}
              </span>
            </div>
            <div className="counter">
              <span className="counter-label">Pages Visited:</span>
              <span className="counter-value">{pagesVisited}</span>
            </div>
            <div className="counter">
              <span className="counter-label">Phones Found:</span>
              <span className="counter-value">{phones.length}</span>
            </div>
            <div className="counter">
              <span className="counter-label">WhatsApp Found:</span>
              <span className="counter-value">{whatsapp.length}</span>
            </div>
            <div className="counter">
              <span className="counter-label">Errors:</span>
              <span className="counter-value">{errors}</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => runSearch(true)}
              disabled={loading || keywords.length === 0 || countries.length === 0}
              className="btn-glass btn-secondary"
            >
              🔍 Dry Run
            </button>
            <button
              onClick={() => runSearch(false)}
              disabled={loading || keywords.length === 0 || countries.length === 0}
              className="btn-glass btn-primary"
            >
              🚀 Start Search
            </button>
            <button
              onClick={() => {
                if (isPaused) {
                  // Resume search
                  if (runId && !loading) {
                    startStreaming(runId);
                    setIsPaused(false);
                  }
                } else {
                  // Pause search
                  if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    setLoading(false);
                    setIsPaused(true);
                  }
                }
              }}
              disabled={!loading && !isPaused}
              className={`btn-glass ${isPaused ? 'btn-warning' : 'btn-danger'}`}
            >
              {isPaused ? '▶️ Resume Search' : '⏸️ Pause Search'}
            </button>
            <button
              onClick={() => {
                if (eventSourceRef.current) {
                  eventSourceRef.current.close();
                  setLoading(false);
                  setIsPaused(false);
                  setPhones([]);
                  setWhatsapp([]);
                  setPagesVisited(0);
                  setErrors(0);
                  setRunId(null);
                }
              }}
              disabled={!loading && !isPaused}
              className="btn-glass btn-danger"
            >
              ⏹️ Stop & Clear
            </button>
          </div>
        </div>

        {/* Phone & WhatsApp Results */}
        {(phones.length > 0 || whatsapp.length > 0) && (
          <div className="results-panel glass">
            <h3>📞 Found Numbers ({phones.length + whatsapp.length})</h3>
            
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>E.164</th>
                    <th>Local</th>
                    <th>Country</th>
                    <th>Source URL</th>
                    <th>Confidence</th>
                    <th>Notes</th>
                    <th>Fetched At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {phones.map((phone, index) => (
                    <tr key={`phone-${index}`}>
                      <td>
                        <span className="badge phone">{phone.type}</span>
                      </td>
                      <td>
                        <code>{phone.e164}</code>
                      </td>
                      <td>
                        <code>{phone.local}</code>
                      </td>
                      <td>{phone.country}</td>
                      <td>
                        <a href={phone.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {phone.sourceUrl}
                        </a>
                      </td>
                      <td>
                        <span className={`confidence ${phone.confidence}`}>
                          {phone.confidence}
                        </span>
                      </td>
                      <td>{phone.note || phone.source}</td>
                      <td>{new Date(phone.fetchedAt).toLocaleString()}</td>
                      <td>
                        <button 
                          onClick={() => navigator.clipboard.writeText(phone.e164)}
                          className="btn-glass"
                        >
                          Copy E.164
                        </button>
                      </td>
                    </tr>
                  ))}
                  {whatsapp.map((wa, index) => (
                    <tr key={`whatsapp-${index}`}>
                      <td>
                        <span className="badge whatsapp">WhatsApp</span>
                      </td>
                      <td>
                        <code>{wa.e164}</code>
                      </td>
                      <td>
                        <code>{wa.local}</code>
                      </td>
                      <td>{wa.country}</td>
                      <td>
                        <a href={wa.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {wa.sourceUrl}
                        </a>
                      </td>
                      <td>
                        <span className={`confidence ${wa.confidence}`}>
                          {wa.confidence}
                        </span>
                      </td>
                      <td>{wa.note || wa.source}</td>
                      <td>{new Date(wa.fetchedAt).toLocaleString()}</td>
                      <td>
                        <button 
                          onClick={() => navigator.clipboard.writeText(wa.e164)}
                          className="btn-glass"
                        >
                          Copy E.164
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Bulk Actions */}
            <div className="bulk-actions">
              <button 
                onClick={() => {
                  const allE164 = [...phones, ...whatsapp].map(p => p.e164).join('\n');
                  navigator.clipboard.writeText(allE164);
                  alert('All E.164 numbers copied to clipboard!');
                }}
                className="btn-glass"
              >
                Copy All E.164
              </button>
              <button 
                onClick={() => {
                  const csvData = [
                    'Type,E.164,Local,Country,Source URL,Confidence,Notes,Fetched At',
                    ...phones.map(p => `Phone,${p.e164},${p.local},${p.country},${p.sourceUrl},${p.confidence},"${p.note || p.source}",${p.fetchedAt}`),
                    ...whatsapp.map(w => `WhatsApp,${w.e164},${w.local},${w.country},${w.sourceUrl},${w.confidence},"${w.note || w.source}",${w.fetchedAt}`)
                  ].join('\n');
                  
                  const blob = new Blob([csvData], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `whatsapp-numbers-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn-glass"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppFinder;
