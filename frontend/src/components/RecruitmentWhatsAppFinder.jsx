import React, { useState, useRef, useEffect } from 'react';
import './LiveCompanyEmailsFinder.css';

const RecruitmentWhatsAppFinder = () => {
  // Configuration state
  const [country, setCountry] = useState('Saudi Arabia');
  const [recruitmentOnly, setRecruitmentOnly] = useState(true);
  const [carrierAware, setCarrierAware] = useState(true);
  const [keywords, setKeywords] = useState([]);
  
  // Search state
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runId, setRunId] = useState(null);
  
  // Results state
  const [phones, setPhones] = useState([]);
  const [whatsapp, setWhatsapp] = useState([]);
  const [companies, setCompanies] = useState(new Set());
  const [domains, setDomains] = useState(new Set());
  const [pagesVisited, setPagesVisited] = useState(0);
  const [errors, setErrors] = useState(0);
  
  const eventSourceRef = useRef(null);
  
  // Country options
  const countries = [
    'Saudi Arabia',
    'United Arab Emirates', 
    'Qatar',
    'Kuwait',
    'Bahrain',
    'Oman',
    'Egypt',
    'Jordan',
    'Lebanon'
  ];
  
  // Keyword presets for recruitment
  const recruitmentPresets = [
    { name: 'Technology', keywords: ['software', 'technology', 'IT', 'developer', 'programmer'] },
    { name: 'Healthcare', keywords: ['medical', 'healthcare', 'hospital', 'doctor', 'nurse'] },
    { name: 'Finance', keywords: ['bank', 'finance', 'financial', 'investment', 'accounting'] },
    { name: 'Education', keywords: ['school', 'university', 'education', 'teacher', 'instructor'] },
    { name: 'Retail', keywords: ['retail', 'sales', 'store', 'shop', 'commerce'] },
    { name: 'Construction', keywords: ['construction', 'building', 'engineering', 'contractor'] }
  ];
  
  // Load settings from localStorage
  useEffect(() => {
    const savedCountry = localStorage.getItem('recruitment-country');
    const savedRecruitmentOnly = localStorage.getItem('recruitment-only');
    const savedCarrierAware = localStorage.getItem('carrier-aware');
    
    if (savedCountry) setCountry(savedCountry);
    if (savedRecruitmentOnly !== null) setRecruitmentOnly(savedRecruitmentOnly === 'true');
    if (savedCarrierAware !== null) setCarrierAware(savedCarrierAware === 'true');
  }, []);
  
  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('recruitment-country', country);
    localStorage.setItem('recruitment-only', recruitmentOnly.toString());
    localStorage.setItem('carrier-aware', carrierAware.toString());
  }, [country, recruitmentOnly, carrierAware]);
  
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
  
  // Start search
  const startSearch = async () => {
    if (keywords.length === 0) {
      alert('Please add at least one keyword');
      return;
    }
    
    setLoading(true);
    setErrors(0);
    setPhones([]);
    setWhatsapp([]);
    setCompanies(new Set());
    setDomains(new Set());
    setPagesVisited(0);
    
    try {
      const response = await fetch('/api/recruitment-phones/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          recruitmentOnly,
          carrierAware,
          keywords,
          maxPages: 4,
          engines: ['ddg'],
          phones: {
            enabled: true,
            types: ['mobile'],
            strict: true,
            perDomainCaps: { phones: 10, whatsapp: 10 }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setRunId(data.runId);
        startStreaming(data.runId);
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
    
    const eventSource = new EventSource(`/api/recruitment-phones/stream/${id}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'result':
          if (data.resultType === 'phone') {
            setPhones(prev => [...prev, data]);
            setCompanies(prev => new Set([...prev, data.companyName]));
            setDomains(prev => new Set([...prev, new URL(data.sourceUrl).hostname]));
          } else if (data.resultType === 'whatsapp') {
            setWhatsapp(prev => [...prev, data]);
            setCompanies(prev => new Set([...prev, data.companyName]));
            setDomains(prev => new Set([...prev, new URL(data.sourceUrl).hostname]));
          }
          break;
          
        case 'trace':
          if (data.scope === 'visit') {
            setPagesVisited(prev => prev + 1);
          }
          break;
          
        case 'progress':
          if (data.phase === 'complete') {
            setLoading(false);
            setIsPaused(false);
          }
          break;
          
        case 'done':
          setLoading(false);
          setIsPaused(false);
          eventSource.close();
          break;
          
        case 'error':
          setErrors(prev => prev + 1);
          setLoading(false);
          eventSource.close();
          break;
      }
    };
    
    eventSource.onerror = () => {
      setLoading(false);
      eventSource.close();
    };
  };
  
  // Hold (pause) search
  const holdSearch = async () => {
    if (!runId) return;
    
    try {
      await fetch(`/api/recruitment-phones/hold/${runId}`, { method: 'POST' });
      setIsPaused(true);
      setLoading(false);
    } catch (error) {
      console.error('Hold error:', error);
    }
  };
  
  // Resume search
  const resumeSearch = async () => {
    if (!runId) return;
    
    try {
      await fetch(`/api/recruitment-phones/resume/${runId}`, { method: 'POST' });
      setIsPaused(false);
      setLoading(true);
    } catch (error) {
      console.error('Resume error:', error);
    }
  };
  
  // Stop search
  const stopSearch = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    if (runId) {
      try {
        await fetch(`/api/recruitment-phones/stop/${runId}`, { method: 'POST' });
      } catch (error) {
        console.error('Stop error:', error);
      }
    }
    
    setLoading(false);
    setIsPaused(false);
    setRunId(null);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  // Get all results combined
  const allResults = [...phones, ...whatsapp];
  
  return (
    <div className="live-company-emails-finder">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">🎯 Recruitment WhatsApp Finder</h1>
          <p className="page-description">
            Find WhatsApp numbers from recruitment pages with carrier validation
          </p>
        </div>
        
        {/* Top Control Bar - Always Visible */}
        <div className="control-bar glass">
          <div className="control-buttons">
            <button
              onClick={startSearch}
              disabled={loading || keywords.length === 0}
              className="btn-glass btn-primary"
            >
              🚀 Start Search
            </button>
            
            <button
              onClick={isPaused ? resumeSearch : holdSearch}
              disabled={!loading && !isPaused}
              className={`btn-glass ${isPaused ? 'btn-warning' : 'btn-secondary'}`}
            >
              {isPaused ? '▶️ Resume' : '⏸️ Hold'}
            </button>
            
            <button
              onClick={stopSearch}
              disabled={!loading && !isPaused}
              className="btn-glass btn-danger"
            >
              ⏹️ Stop
            </button>
          </div>
          
          <div className="status-indicator">
            <span className={`status ${loading ? 'running' : isPaused ? 'paused' : 'stopped'}`}>
              {loading ? '🟢 Running' : isPaused ? '🟡 Paused' : '🔴 Stopped'}
            </span>
          </div>
        </div>
        
        {/* Configuration */}
        <div className="config-section glass">
          <h3>🌍 Country & Settings</h3>
          
          <div className="config-grid">
            <div className="config-group">
              <label>Country:</label>
              <select 
                value={country} 
                onChange={(e) => setCountry(e.target.value)}
                disabled={loading}
              >
                {countries.map(countryName => (
                  <option key={countryName} value={countryName}>
                    {countryName}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="config-group">
              <label>
                <input
                  type="checkbox"
                  checked={recruitmentOnly}
                  onChange={(e) => setRecruitmentOnly(e.target.checked)}
                  disabled={loading}
                />
                Recruitment Pages Only
              </label>
            </div>
            
            <div className="config-group">
              <label>
                <input
                  type="checkbox"
                  checked={carrierAware}
                  onChange={(e) => setCarrierAware(e.target.checked)}
                  disabled={loading}
                />
                Carrier Validation
              </label>
            </div>
          </div>
        </div>
        
        {/* Keywords */}
        <div className="config-section glass">
          <h3>🔍 Keywords</h3>
          
          <div className="keyword-input-section">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter keywords (e.g., technology, medical, finance)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addKeyword(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={loading}
              />
              <button 
                className="btn btn-primary"
                onClick={(e) => {
                  const input = e.target.previousElementSibling;
                  addKeyword(input.value);
                  input.value = '';
                }}
                disabled={loading}
              >
                Add
              </button>
            </div>
            
            <div className="keyword-presets">
              <label>Recruitment Presets:</label>
              <div className="preset-buttons">
                {recruitmentPresets.map((preset, index) => (
                  <button
                    key={index}
                    className="btn btn-secondary"
                    onClick={() => loadPreset(preset)}
                    disabled={loading}
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
                  <button onClick={() => removeKeyword(keyword)} disabled={loading}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* Live Counters */}
        <div className="counters-panel glass">
          <div className="live-counters">
            <div className="counter">
              <span className="counter-label">Found:</span>
              <span className="counter-value">{allResults.length}</span>
            </div>
            <div className="counter">
              <span className="counter-label">Companies:</span>
              <span className="counter-value">{companies.size}</span>
            </div>
            <div className="counter">
              <span className="counter-label">Domains:</span>
              <span className="counter-value">{domains.size}</span>
            </div>
            <div className="counter">
              <span className="counter-label">Pages:</span>
              <span className="counter-value">{pagesVisited}</span>
            </div>
            <div className="counter">
              <span className="counter-label">Errors:</span>
              <span className="counter-value">{errors}</span>
            </div>
          </div>
        </div>
        
        {/* Results Table */}
        {allResults.length > 0 && (
          <div className="results-panel glass">
            <h3>📞 Found Numbers ({allResults.length})</h3>
            
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>E.164</th>
                    <th>Company</th>
                    <th>Source URL</th>
                    <th>Country</th>
                    <th>Carrier</th>
                    <th>Evidence</th>
                    <th>Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allResults.map((result, index) => (
                    <tr key={index}>
                      <td>
                        <code>{result.e164}</code>
                      </td>
                      <td>
                        <strong>{result.companyName}</strong>
                        <br/>
                        <small>{result.companySource}</small>
                      </td>
                      <td>
                        <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {new URL(result.sourceUrl).hostname}
                        </a>
                      </td>
                      <td>{result.country}</td>
                      <td>
                        <span className={`badge carrier ${result.carrier?.toLowerCase()}`}>
                          {result.carrier || 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <div className="evidence">
                          <div><strong>Recruitment:</strong> {result.recruitmentEvidence}</div>
                          <div><strong>Source:</strong> {result.source}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`confidence ${result.confidence}`}>
                          {result.confidence}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => navigator.clipboard.writeText(result.e164)}
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
                  const allE164 = allResults.map(r => r.e164).join('\n');
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
                    'E.164,Company,Source URL,Country,Carrier,Evidence,Confidence,Fetched At',
                    ...allResults.map(r => `${r.e164},"${r.companyName}",${r.sourceUrl},${r.country},${r.carrier},"${r.recruitmentEvidence}",${r.confidence},${r.fetchedAt}`)
                  ].join('\n');
                  
                  const blob = new Blob([csvData], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `recruitment-whatsapp-${new Date().toISOString().split('T')[0]}.csv`;
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

export default RecruitmentWhatsAppFinder;
