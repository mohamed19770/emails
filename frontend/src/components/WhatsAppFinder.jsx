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
  const [whatsappOnly, setWhatsappOnly] = useState(true);
  const [showRegularPhones, setShowRegularPhones] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState({ enabled: false, strict: true, provider: 'none' });
  
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

  useEffect(() => {
    fetch('/api/whatsapp-verify/status')
      .then(r => r.json())
      .then(data => setVerifyStatus(data))
      .catch(() => setVerifyStatus({ enabled: false, strict: true, provider: 'none' }));
  }, []);
  
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
          strictPhoneMode,
          whatsappOnly
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
              hasWhatsAppLink: data.hasWhatsAppLink,
              waLink: data.waLink,
              whatsappVerified: data.whatsappVerified,
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
            ابحث عن أرقام واتساب من مواقع الشركات — يعرض فقط الأرقام المرتبطة برابط wa.me أو مذكورة صراحة كواتساب
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
            {engines.includes('ddg') && !verifyStatus.enabled && (
              <div className="warning-banner">
                ⚠️ <strong>التحقق من واتساب غير مفعّل:</strong> لن تُعرض أي أرقام حتى تضيف API للتحقق.
                <br/>أضف في <code>backend/.env</code>: WHATSAPP_VERIFY_PROVIDER=2chat و WHATSAPP_VERIFY_API_KEY
                <br/>رابط wa.me على الموقع لا يعني أن الرقم مسجّل فعلاً على واتساب (كما في صورتك: +966520916465).
              </div>
            )}
            {engines.includes('ddg') && verifyStatus.enabled && (
              <div className="success-banner">
                ✅ <strong>التحقق مفعّل ({verifyStatus.provider}):</strong> تُعرض فقط الأرقام المؤكدة على واتساب.
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

        <div className="config-section glass">
          <h3>⚙️ خيارات العرض</h3>
          <label className="country-option">
            <input
              type="checkbox"
              checked={whatsappOnly}
              onChange={(e) => setWhatsappOnly(e.target.checked)}
            />
            <span>واتساب فقط — إخفاء أرقام الهاتف العادية</span>
          </label>
          {!whatsappOnly && (
            <label className="country-option">
              <input
                type="checkbox"
                checked={showRegularPhones}
                onChange={(e) => setShowRegularPhones(e.target.checked)}
              />
              <span>إظهار أرقام الهاتف العادية (غير مؤكد واتساب)</span>
            </label>
          )}
        </div>

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

        {/* WhatsApp Results */}
        {whatsapp.length > 0 && (
          <div className="results-panel glass">
            <h3>💬 أرقام واتساب ({whatsapp.length})</h3>
            
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>E.164</th>
                    <th>محلي</th>
                    <th>الدولة</th>
                    <th>المصدر</th>
                    <th>الثقة</th>
                    <th>ملاحظات</th>
                    <th>التاريخ</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {whatsapp.map((wa, index) => {
                    const waDigits = wa.e164?.replace(/\D/g, '') || '';
                    const waUrl = wa.waLink || `https://wa.me/${waDigits}`;
                    return (
                    <tr key={`whatsapp-${index}`}>
                      <td>
                        <span className="badge whatsapp">
                          {wa.whatsappVerified ? '✓ مؤكد' : wa.hasWhatsAppLink ? 'رابط wa.me' : 'نص واتساب'}
                        </span>
                      </td>
                      <td><code>{wa.e164}</code></td>
                      <td><code>{wa.local}</code></td>
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
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-glass"
                          style={{ marginRight: '0.5rem', textDecoration: 'none', display: 'inline-block' }}
                        >
                          فتح واتساب
                        </a>
                        <button 
                          onClick={() => navigator.clipboard.writeText(wa.e164)}
                          className="btn-glass"
                        >
                          نسخ
                        </button>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            
            <div className="bulk-actions">
              <button 
                onClick={() => {
                  const allE164 = whatsapp.map(p => p.e164).join('\n');
                  navigator.clipboard.writeText(allE164);
                  alert('تم نسخ أرقام واتساب!');
                }}
                className="btn-glass"
              >
                نسخ كل أرقام واتساب
              </button>
              <button 
                onClick={() => {
                  const csvData = [
                    'Type,E.164,Local,Country,Source URL,Confidence,Notes,Fetched At',
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

        {!whatsappOnly && showRegularPhones && phones.length > 0 && (
          <div className="results-panel glass">
            <h3>📞 أرقام هاتف عادية — غير مؤكد واتساب ({phones.length})</h3>
            <p style={{ opacity: 0.8, marginBottom: '1rem' }}>
              هذه الأرقام من روابط tel: أو نص الصفحة وقد لا تكون مسجلة على واتساب
            </p>
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>E.164</th>
                    <th>محلي</th>
                    <th>المصدر</th>
                    <th>ملاحظات</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {phones.map((phone, index) => (
                    <tr key={`phone-${index}`}>
                      <td><span className="badge phone">{phone.type}</span></td>
                      <td><code>{phone.e164}</code></td>
                      <td><code>{phone.local}</code></td>
                      <td>
                        <a href={phone.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {phone.sourceUrl}
                        </a>
                      </td>
                      <td>{phone.note || phone.source}</td>
                      <td>
                        <a
                          href={`https://wa.me/${phone.e164?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-glass"
                          style={{ textDecoration: 'none', display: 'inline-block' }}
                        >
                          تجربة واتساب
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && whatsapp.length === 0 && runId && (
          <div className="config-section glass" style={{ textAlign: 'center', padding: '2rem' }}>
            {!verifyStatus.enabled ? (
              <>
                <p><strong>لا توجد أرقام واتساب مؤكدة.</strong></p>
                <p>فعّل التحقق عبر API (2Chat أو Wawp) في backend/.env ثم أعد البحث.</p>
                <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                  بدون API، الأرقام المستخرجة من المواقع قد لا تكون مسجلة على واتساب.
                </p>
              </>
            ) : (
              <p>لم يُعثر على أرقام واتساب مؤكدة. جرّب كلمات: whatsapp، واتساب، careers، وظائف</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppFinder;
