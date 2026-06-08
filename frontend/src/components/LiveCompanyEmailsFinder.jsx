import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LiveCompanyEmailsFinder.css';

const LiveCompanyEmailsFinder = ({ embedded = false }) => {
  // Config state
  const [prefixes, setPrefixes] = useState(['hr@', 'jobs@', 'careers@', 'recruitment@', 'talent@', 'hiring@']);
  const [keywords, setKeywords] = useState([]);
  const [countries, setCountries] = useState(['Saudi Arabia']);
  const [locations, setLocations] = useState('');
  const [engines, setEngines] = useState(['ddg']);
  const [maxPages, setMaxPages] = useState(2);
  const [maxEmailsPerDomain, setMaxEmailsPerDomain] = useState(3);
  
  // Site-Wide Exploration Mode state
  const [siteWideMode, setSiteWideMode] = useState(true);
  const [depthLimit, setDepthLimit] = useState(3);
  const [maxPagesPerDomainPerCycle, setMaxPagesPerDomainPerCycle] = useState(40);
  const [recrawlDelayMinutes, setRecrawlDelayMinutes] = useState(60);
  const [scope, setScope] = useState('inDomain'); // 'inDomain' | 'sameOrg' | 'external'
  const [includePatterns, setIncludePatterns] = useState([]);
  const [excludePatterns, setExcludePatterns] = useState([
    '/\\b(auth|login|logout|cart|checkout|subscribe)\\b/i',
    '/\\b(privacy|terms|cookies)\\b/i',
    '/\\b(tag|category|archive|calendar)\\b/i',
    '/\\?(utm_|fbclid|gclid)/i'
  ]);
  const [excludeExtensions, setExcludeExtensions] = useState({
    images: false,
    binaries: false,
    media: false,
    docs: false
  });
  const [heuristics, setHeuristics] = useState({
    preferHiringContact: true,
    preferMailto: true,
    downrankPagination: true
  });
  
  // Search state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [runId, setRunId] = useState(null);
  
  // Results state
  const [emails, setEmails] = useState([]);
  const [domains, setDomains] = useState(new Set());
  const [pagesVisited, setPagesVisited] = useState(0);
  const [serpPagesFetched, setSerpPagesFetched] = useState(0);
  const [errors, setErrors] = useState(0);
  
  // Phone extraction state
  const [extractPhones, setExtractPhones] = useState(true);
  const [phoneTypes, setPhoneTypes] = useState(['mobile', 'landline', 'toll-free']);
  const [maxPhonesPerDomain, setMaxPhonesPerDomain] = useState(5);
  const [maxWhatsAppPerDomain, setMaxWhatsAppPerDomain] = useState(3);
  const [strictPhoneMode, setStrictPhoneMode] = useState(false);
  const [phones, setPhones] = useState([]);
  const [whatsapp, setWhatsapp] = useState([]);
  const [backoffs, setBackoffs] = useState(0);
  
  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineFilters, setTimelineFilters] = useState({
    engines: [],
    scopes: [],
    countries: [],
    statuses: []
  });
  
  // Presets
  const builtInPresets = {
    'HR Hiring (EN)': ['HR', 'recruitment', 'recruiter', 'talent acquisition', 'hiring', 'careers'],
    'Tech Hiring (EN)': ['engineer', 'developer', 'software engineer', 'backend', 'frontend', 'fullstack', 'devops'],
    'Medical (EN)': ['doctor', 'physician', 'nurse', 'pharmacist', 'radiology', 'lab technician'],
    'Arabic Generic (AR)': ['وظائف', 'توظيف', 'موارد بشرية', 'توظيف فوري', 'فرص عمل'],
    'Arabic Tech (AR)': ['مهندس', 'مطور', 'برمجة', 'بنية تحتية', 'شبكات', 'أمن المعلومات']
  };
  
  const [userPresets, setUserPresets] = useState(() => {
    const saved = localStorage.getItem('finder.keywordPresets');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  
  // Refs
  const eventSourceRef = useRef(null);
  const timelineCanvasRef = useRef(null);
  const timelineContainerRef = useRef(null);
  
  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('finder.config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setPrefixes(config.prefixes || prefixes);
      setKeywords(config.keywords || []);
      setCountries(config.countries || ['Saudi Arabia']);
      setLocations(config.locations || '');
      setEngines(config.engines || ['ddg']);
      setMaxPages(config.maxPages || 2);
      setMaxEmailsPerDomain(config.maxEmailsPerDomain || 3);
      
      // Load exploration config
      if (config.exploration) {
        setSiteWideMode(config.exploration.siteWide !== false);
        setDepthLimit(config.exploration.depthLimit || 3);
        setMaxPagesPerDomainPerCycle(config.exploration.maxPagesPerDomainPerCycle || 40);
        setRecrawlDelayMinutes(config.exploration.recrawlDelayMinutes || 60);
        setScope(config.exploration.scope || 'inDomain');
        setIncludePatterns(config.exploration.includePatterns || []);
        setExcludePatterns(config.exploration.excludePatterns || [
          '/\\b(auth|login|logout|cart|checkout|subscribe)\\b/i',
          '/\\b(privacy|terms|cookies)\\b/i',
          '/\\b(tag|category|archive|calendar)\\b/i',
          '/\\?(utm_|fbclid|gclid)/i'
        ]);
        setExcludeExtensions(config.exploration.excludeExtensions || {
          images: false,
          binaries: false,
          media: false,
          docs: false
        });
        setHeuristics(config.exploration.heuristics || {
          preferHiringContact: true,
          preferMailto: true,
          downrankPagination: true
        });
      }
    }
  }, []);
  
  // Save config to localStorage
  const saveConfig = useCallback(() => {
    const config = {
      prefixes,
      keywords,
      countries,
      locations,
      engines,
      maxPages,
      maxEmailsPerDomain,
      exploration: {
        siteWide: siteWideMode,
        depthLimit,
        maxPagesPerDomainPerCycle,
        recrawlDelayMinutes,
        scope,
        includePatterns,
        excludePatterns,
        excludeExtensions,
        heuristics
      }
    };
    localStorage.setItem('finder.config', JSON.stringify(config));
  }, [prefixes, keywords, countries, locations, engines, maxPages, maxEmailsPerDomain, 
      siteWideMode, depthLimit, maxPagesPerDomainPerCycle, recrawlDelayMinutes, scope, 
      includePatterns, excludePatterns, excludeExtensions, heuristics]);
  
  // Save user presets
  const saveUserPresets = useCallback(() => {
    localStorage.setItem('finder.keywordPresets', JSON.stringify(userPresets));
  }, [userPresets]);
  
  // Country options
  const countryOptions = [
    'Saudi Arabia', 'UAE', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 
    'Egypt', 'Jordan', 'Lebanon'
  ];
  
  // Add prefix
  const addPrefix = (prefix) => {
    if (prefix && !prefixes.includes(prefix)) {
      setPrefixes([...prefixes, prefix]);
    }
  };
  
  // Remove prefix
  const removePrefix = (prefix) => {
    setPrefixes(prefixes.filter(p => p !== prefix));
  };
  
  // Add keyword
  const addKeyword = (keyword) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords([...keywords, keyword]);
    }
  };
  
  // Remove keyword
  const removeKeyword = (keyword) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };
  
  // Add country
  const addCountry = (country) => {
    if (country && !countries.includes(country)) {
      setCountries([...countries, country]);
    }
  };
  
  // Remove country
  const removeCountry = (country) => {
    setCountries(countries.filter(c => c !== country));
  };
  
  // Add location
  const addLocation = (location) => {
    if (location) {
      const newLocations = locations ? `${locations}, ${location}` : location;
      setLocations(newLocations);
    }
  };
  
  // Insert preset
  const insertPreset = (presetName) => {
    const preset = builtInPresets[presetName] || userPresets[presetName];
    if (preset) {
      const newKeywords = [...new Set([...keywords, ...preset])];
      setKeywords(newKeywords);
    }
  };
  
  // Save current keywords as preset
  const saveCurrentAsPreset = () => {
    if (keywords.length > 0 && newPresetName) {
      setUserPresets({...userPresets, [newPresetName]: keywords});
      setNewPresetName('');
      setShowPresetModal(false);
    }
  };
  
  // Delete preset
  const deletePreset = (presetName) => {
    const newPresets = {...userPresets};
    delete newPresets[presetName];
    setUserPresets(newPresets);
  };
  
  // Clear keywords
  const clearKeywords = () => {
    setKeywords([]);
  };
  
  // Get exclude extensions list based on checkboxes
  const getExcludeExtensionsList = () => {
    const extensions = [];
    if (excludeExtensions.images) {
      extensions.push('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg');
    }
    if (excludeExtensions.binaries) {
      extensions.push('zip', 'rar', '7z', 'exe');
    }
    if (excludeExtensions.media) {
      extensions.push('mp4', 'mp3', 'avi', 'mov', 'wav');
    }
    if (excludeExtensions.docs) {
      extensions.push('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx');
    }
    return extensions;
  };
  
  // Add include pattern
  const addIncludePattern = (pattern) => {
    if (pattern && !includePatterns.includes(pattern)) {
      setIncludePatterns([...includePatterns, pattern]);
    }
  };
  
  // Remove include pattern
  const removeIncludePattern = (pattern) => {
    setIncludePatterns(includePatterns.filter(p => p !== pattern));
  };
  
  // Add exclude pattern
  const addExcludePattern = (pattern) => {
    if (pattern && !excludePatterns.includes(pattern)) {
      setExcludePatterns([...excludePatterns, pattern]);
    }
  };
  
  // Remove exclude pattern
  const removeExcludePattern = (pattern) => {
    setExcludePatterns(excludePatterns.filter(p => p !== pattern));
  };
  
  // Export config
  const exportConfig = () => {
    const config = {
      prefixes,
      keywords,
      countries,
      locations,
      engines,
      maxPages,
      maxEmailsPerDomain,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finder-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Import config
  const importConfig = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          setPrefixes(config.prefixes || prefixes);
          setKeywords(config.keywords || []);
          setCountries(config.countries || ['Saudi Arabia']);
          setLocations(config.locations || '');
          setEngines(config.engines || ['ddg']);
          setMaxPages(config.maxPages || 2);
          setMaxEmailsPerDomain(config.maxEmailsPerDomain || 3);
        } catch (error) {
          console.error('Error importing config:', error);
        }
      };
      reader.readAsText(file);
    }
  };
  
  // Start search
  const startSearch = async (dryRun = false) => {
    if (!keywords.length || !countries.length) {
      alert('Please select at least one keyword and one country');
      return;
    }
    
    try {
      const explorationConfig = {
        siteWide: siteWideMode,
        depthLimit,
        maxPagesPerDomainPerCycle,
        recrawlDelayMinutes,
        scope,
        includePatterns,
        excludePatterns,
        excludeExtensions: getExcludeExtensionsList(),
        heuristics
      };
      
      console.log('Starting search with:', { 
        prefixes, 
        keywords, 
        countries, 
        locations: locations.split(',').map(l => l.trim()).filter(l => l), 
        engines, 
        maxPages, 
        maxEmailsPerDomain,
        exploration: explorationConfig
      });
      
      const response = await fetch(`/api/prefix-emails/run?dry=${dryRun ? 1 : 0}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefixes,
          keywords,
          countries,
          locations: locations.split(',').map(l => l.trim()).filter(l => l),
          engines,
          maxPages,
          maxEmailsPerDomain,
          exploration: explorationConfig,
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
      console.log('API response:', data);
      if (data.success) {
        setRunId(data.runId);
        if (!dryRun) {
          startStreaming(data.runId);
        }
      } else {
        console.error('Search failed:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error starting search:', error);
    }
  };
  
  // Start streaming
  const startStreaming = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setIsRunning(true);
    setIsPaused(false);
    setIsStopped(false);
    setEmails([]);
    setDomains(new Set());
    setPhones([]);
    setWhatsapp([]);
    setPagesVisited(0);
    setSerpPagesFetched(0);
    setErrors(0);
    setBackoffs(0);
    setTimelineEvents([]);
    
    const eventSource = new EventSource(`/api/prefix-emails/stream/${id}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // console.log('SSE Event received:', data); // Removed for cleaner console
      
      switch (data.type) {
        case 'progress':
          // Update progress counters
          break;
          
        case 'trace':
          setTimelineEvents(prev => [...prev, {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            scope: data.scope,
            engine: data.engine,
            country: data.country,
            query: data.query,
            url: data.url,
            status: data.status,
            duration: data.durationMs,
            note: data.note
          }]);
          break;
          
        case 'result':
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
          } else {
            // Regular email result
            setEmails(prev => [...prev, {
              email: data.email,
              domain: data.domain,
              title: data.title,
              sourceUrl: data.sourceUrl,
              engine: data.engine,
              snippet: data.snippet,
              fetchedAt: data.fetchedAt
            }]);
            setDomains(prev => new Set([...prev, data.domain]));
          }
          break;
          
        case 'checkpoint':
          // Update checkpoint stats
          break;
          
        case 'error':
          setErrors(prev => prev + 1);
          break;
          
        case 'done':
          setIsRunning(false);
          setIsStopped(true);
          eventSource.close();
          break;
      }
    };
    
    eventSource.onerror = () => {
      setIsRunning(false);
      setIsStopped(true);
      eventSource.close();
    };
  };
  
  // Control functions
  const holdSearch = async () => {
    if (runId) {
      await fetch('/api/prefix-emails/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });
      setIsPaused(true);
    }
  };
  
  const resumeSearch = async () => {
    if (runId) {
      await fetch('/api/prefix-emails/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });
      setIsPaused(false);
    }
  };
  
  const stopSearch = async () => {
    if (runId) {
      await fetch('/api/prefix-emails/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });
      setIsRunning(false);
      setIsStopped(true);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }
  };
  
  // Copy all emails
  const copyAllEmails = () => {
    const emailList = emails.map(e => e.email).join('\n');
    navigator.clipboard.writeText(emailList);
  };
  
  // Export results as CSV
  const exportCSV = () => {
    const csv = [
      'Email,Domain,Title,Source URL,Engine,Snippet,Fetched At',
      ...emails.map(e => `"${e.email}","${e.domain}","${e.title}","${e.sourceUrl}","${e.engine}","${e.snippet}","${e.fetchedAt}"`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emails.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Export results as JSON
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(emails, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emails.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  return (
    <div className={`live-company-emails-finder ${embedded ? 'embedded' : ''}`}>
      <div className="config-panel glass">
        {!embedded && <h2>🔍 Live Company Emails Finder</h2>}
        
        {/* Prefixes */}
        <div className="config-section">
          <label>Prefixes:</label>
          <div className="chips-container">
            {prefixes.map(prefix => (
              <span key={prefix} className="chip chip-prefix">
                {prefix}
                <button onClick={() => removePrefix(prefix)}>×</button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add prefix..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addPrefix(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
        
        {/* Keywords */}
        <div className="config-section">
          <label>Keywords: {keywords.length}</label>
          <div className="chips-container">
            {keywords.map(keyword => (
              <span key={keyword} className="chip chip-keyword">
                {keyword}
                <button onClick={() => removeKeyword(keyword)}>×</button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add keyword..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addKeyword(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>
          
          <div className="preset-controls">
            <select onChange={(e) => insertPreset(e.target.value)}>
              <option value="">Insert preset...</option>
              {Object.keys(builtInPresets).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              {Object.keys(userPresets).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            
            <button onClick={() => setShowPresetModal(true)} className="btn-glass">
              Save as preset
            </button>
            
            <button onClick={clearKeywords} className="btn-glass">
              Clear
            </button>
          </div>
        </div>
        
        {/* Countries */}
        <div className="config-section">
          <label>Countries:</label>
          <div className="chips-container">
            {countries.map(country => (
              <span key={country} className="chip chip-country">
                {country}
                <button onClick={() => removeCountry(country)}>×</button>
              </span>
            ))}
            <select onChange={(e) => addCountry(e.target.value)}>
              <option value="">Add country...</option>
              {countryOptions.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>
        </div>
        
        {/* Locations */}
        <div className="config-section">
          <label>Locations (optional):</label>
          <input
            type="text"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="Riyadh, Jeddah, Dubai..."
          />
        </div>
        
        {/* Engines */}
        <div className="config-section">
          <label>Engines:</label>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={engines.includes('ddg')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEngines([...engines, 'ddg']);
                  } else {
                    setEngines(engines.filter(e => e !== 'ddg'));
                  }
                }}
              />
              DuckDuckGo
            </label>
            <label>
              <input
                type="checkbox"
                checked={engines.includes('mock')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEngines([...engines, 'mock']);
                  } else {
                    setEngines(engines.filter(e => e !== 'mock'));
                  }
                }}
              />
              Mock
            </label>
          </div>
        </div>
        
        {/* Max Pages */}
        <div className="config-section">
          <label>Max Pages:</label>
          <input
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
            min="1"
            max="5"
          />
        </div>
        
        {/* Max Emails Per Domain */}
        <div className="config-section">
          <label>Max Emails Per Domain:</label>
          <input
            type="number"
            value={maxEmailsPerDomain}
            onChange={(e) => setMaxEmailsPerDomain(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
          />
        </div>
        
        {/* Site-Wide Exploration Mode */}
        <div className="config-section">
          <div className="section-header">
            <label>
              <input
                type="checkbox"
                checked={siteWideMode}
                onChange={(e) => setSiteWideMode(e.target.checked)}
              />
              🌐 Site-Wide Exploration Mode
            </label>
            {siteWideMode && <span className="chip running">ON</span>}
          </div>
          
          {siteWideMode && (
            <div className="exploration-config">
              {/* Max Crawl Depth */}
              <div className="config-subsection">
                <label>Max Crawl Depth:</label>
                <input
                  type="number"
                  value={depthLimit}
                  onChange={(e) => setDepthLimit(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                  min="1"
                  max="6"
                />
              </div>
              
              {/* Max Pages Per Domain Per Cycle */}
              <div className="config-subsection">
                <label>Max Pages Per Domain Per Cycle:</label>
                <input
                  type="number"
                  value={maxPagesPerDomainPerCycle}
                  onChange={(e) => setMaxPagesPerDomainPerCycle(Math.min(500, Math.max(10, parseInt(e.target.value) || 40)))}
                  min="10"
                  max="500"
                />
              </div>
              
              {/* Recrawl Delay */}
              <div className="config-subsection">
                <label>Recrawl Delay Per Domain (min):</label>
                <input
                  type="number"
                  value={recrawlDelayMinutes}
                  onChange={(e) => setRecrawlDelayMinutes(Math.max(1, parseInt(e.target.value) || 60))}
                  min="1"
                />
              </div>
              
              {/* In-domain vs Cross-domain */}
              <div className="config-subsection">
                <label>Scope:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="inDomain"
                      checked={scope === 'inDomain'}
                      onChange={(e) => setScope(e.target.value)}
                    />
                    In-domain only
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="sameOrg"
                      checked={scope === 'sameOrg'}
                      onChange={(e) => setScope(e.target.value)}
                    />
                    Allow same-org subdomains
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="external"
                      checked={scope === 'external'}
                      onChange={(e) => setScope(e.target.value)}
                    />
                    Allow external links
                  </label>
                </div>
              </div>
              
              {/* URL Include Patterns */}
              <div className="config-subsection">
                <label>URL Include Patterns (optional):</label>
                <div className="chips-container">
                  {includePatterns.map(pattern => (
                    <span key={pattern} className="chip chip-pattern">
                      {pattern}
                      <button onClick={() => removeIncludePattern(pattern)}>×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add include pattern..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addIncludePattern(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* URL Exclude Patterns */}
              <div className="config-subsection">
                <label>URL Exclude Patterns:</label>
                <div className="chips-container">
                  {excludePatterns.map(pattern => (
                    <span key={pattern} className="chip chip-pattern">
                      {pattern}
                      <button onClick={() => removeExcludePattern(pattern)}>×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add exclude pattern..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addExcludePattern(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* MIME/Extension Excludes */}
              <div className="config-subsection">
                <label>MIME/Extension Excludes:</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={excludeExtensions.images}
                      onChange={(e) => setExcludeExtensions({...excludeExtensions, images: e.target.checked})}
                    />
                    Images (png,jpg,gif,webp,svg)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={excludeExtensions.binaries}
                      onChange={(e) => setExcludeExtensions({...excludeExtensions, binaries: e.target.checked})}
                    />
                    Binaries (zip,rar,exe)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={excludeExtensions.media}
                      onChange={(e) => setExcludeExtensions({...excludeExtensions, media: e.target.checked})}
                    />
                    Media (mp4,mp3)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={excludeExtensions.docs}
                      onChange={(e) => setExcludeExtensions({...excludeExtensions, docs: e.target.checked})}
                    />
                    Docs (pdf,docx,xlsx)
                  </label>
                </div>
              </div>
              
              {/* Heuristic Filters */}
              <div className="config-subsection">
                <label>Heuristic Filters:</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={heuristics.preferHiringContact}
                      onChange={(e) => setHeuristics({...heuristics, preferHiringContact: e.target.checked})}
                    />
                    Prefer pages containing hiring/contact words
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={heuristics.preferMailto}
                      onChange={(e) => setHeuristics({...heuristics, preferMailto: e.target.checked})}
                    />
                    Prefer pages with mailto: anchors
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={heuristics.downrankPagination}
                      onChange={(e) => setHeuristics({...heuristics, downrankPagination: e.target.checked})}
                    />
                    Down-rank pagination traps (page=\d+, /archive/)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="config-controls">
          <button onClick={() => startSearch(true)} className="btn-glass">
            Dry Run
          </button>
          <button 
            onClick={() => startSearch(false)} 
            className="btn-glass"
            disabled={!keywords.length || !countries.length}
          >
            Run Search
          </button>
          <button onClick={holdSearch} className="btn-glass" disabled={!isRunning}>
            Hold
          </button>
          <button onClick={resumeSearch} className="btn-glass" disabled={!isPaused}>
            Resume
          </button>
          <button onClick={stopSearch} className="btn-glass" disabled={!isRunning}>
            Stop
          </button>
        </div>
        
        {/* Config Management */}
        <div className="config-management">
          <button onClick={saveConfig} className="btn-glass">
            Save Config
          </button>
          <button onClick={exportConfig} className="btn-glass">
            Export Config
          </button>
          <label className="btn-glass">
            Import Config
            <input type="file" accept=".json" onChange={importConfig} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      
      {/* Phone & WhatsApp Extraction */}
      <div className="config-section glass">
        <div className="section-header">
          <label>
            <input
              type="checkbox"
              checked={extractPhones}
              onChange={(e) => setExtractPhones(e.target.checked)}
            />
            📞 Phone & WhatsApp Extraction
          </label>
          {extractPhones && <span className="chip running">ON</span>}
        </div>
        
        {extractPhones && (
          <div className="phone-config">
            {/* Phone Types */}
            <div className="config-subsection">
              <label>Phone Types to Extract:</label>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={phoneTypes.includes('mobile')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPhoneTypes([...phoneTypes, 'mobile']);
                      } else {
                        setPhoneTypes(phoneTypes.filter(t => t !== 'mobile'));
                      }
                    }}
                  />
                  Mobile
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={phoneTypes.includes('landline')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPhoneTypes([...phoneTypes, 'landline']);
                      } else {
                        setPhoneTypes(phoneTypes.filter(t => t !== 'landline'));
                      }
                    }}
                  />
                  Landline
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={phoneTypes.includes('toll-free')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPhoneTypes([...phoneTypes, 'toll-free']);
                      } else {
                        setPhoneTypes(phoneTypes.filter(t => t !== 'toll-free'));
                      }
                    }}
                  />
                  Toll-free
                </label>
              </div>
            </div>
            
            {/* Limits */}
            <div className="config-row">
              <div className="config-subsection">
                <label>Max Phones Per Domain:</label>
                <input
                  type="number"
                  value={maxPhonesPerDomain}
                  onChange={(e) => setMaxPhonesPerDomain(Math.min(20, Math.max(1, parseInt(e.target.value) || 5)))}
                  min="1"
                  max="20"
                />
              </div>
              
              <div className="config-subsection">
                <label>Max WhatsApp Per Domain:</label>
                <input
                  type="number"
                  value={maxWhatsAppPerDomain}
                  onChange={(e) => setMaxWhatsAppPerDomain(Math.min(10, Math.max(1, parseInt(e.target.value) || 3)))}
                  min="1"
                  max="10"
                />
              </div>
            </div>
            
            {/* Strict Mode */}
            <div className="config-subsection">
              <label>
                <input
                  type="checkbox"
                  checked={strictPhoneMode}
                  onChange={(e) => setStrictPhoneMode(e.target.checked)}
                />
                Strict Mode (High Confidence Only)
              </label>
            </div>
          </div>
        )}
      </div>
      
      {/* Search Operation Panel */}
      <div className="search-operation-panel glass">
        <h3>Search Operation</h3>
        
        <div className="stepper">
          <div className={`step ${isRunning ? 'active' : ''}`}>Discovery</div>
          <div className={`step ${isRunning ? 'active' : ''}`}>SERP Fetching</div>
          <div className={`step ${isRunning ? 'active' : ''}`}>Page Visits</div>
          <div className={`step ${isRunning ? 'active' : ''}`}>Email Extraction</div>
          <div className={`step ${isStopped ? 'active' : ''}`}>Done</div>
        </div>
        
        <div className="progress-bars">
          <div className="progress-bar">
            <div className="progress-label">Overall Progress</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
        
        <div className="live-counters">
          <div className="counter">
            <span className="counter-label">Emails Found:</span>
            <span className="counter-value">{emails.length}</span>
          </div>
          <div className="counter">
            <span className="counter-label">Unique Domains:</span>
            <span className="counter-value">{domains.size}</span>
          </div>
          <div className="counter">
            <span className="counter-label">Pages Visited:</span>
            <span className="counter-value">{pagesVisited}</span>
          </div>
          {extractPhones && (
            <>
              <div className="counter">
                <span className="counter-label">Phones Found:</span>
                <span className="counter-value">{phones.length}</span>
              </div>
              <div className="counter">
                <span className="counter-label">WhatsApp Found:</span>
                <span className="counter-value">{whatsapp.length}</span>
              </div>
            </>
          )}
          <div className="counter">
            <span className="counter-label">SERP Pages:</span>
            <span className="counter-value">{serpPagesFetched}</span>
          </div>
          {siteWideMode && (
            <>
              <div className="counter">
                <span className="counter-label">Site Queue:</span>
                <span className="counter-value">0</span>
              </div>
              <div className="counter">
                <span className="counter-label">SERP Queue:</span>
                <span className="counter-value">0</span>
              </div>
              <div className="counter">
                <span className="counter-label">Visited Total:</span>
                <span className="counter-value">{pagesVisited}</span>
              </div>
            </>
          )}
          <div className="counter">
            <span className="counter-label">Errors:</span>
            <span className="counter-value">{errors}</span>
          </div>
          <div className="counter">
            <span className="counter-label">Backoffs:</span>
            <span className="counter-value">{backoffs}</span>
          </div>
        </div>
        
        <div className="state-chip">
          {isRunning && !isPaused && <span className="chip running">RUNNING</span>}
          {isPaused && <span className="chip paused">PAUSED</span>}
          {isStopped && <span className="chip stopped">STOPPED</span>}
          {!isRunning && !isStopped && <span className="chip ready">READY</span>}
        </div>
      </div>
      
      {/* Timeline Visualization */}
      <div className="timeline-panel glass">
        <h3>Timeline Visualization</h3>
        <div className="timeline-controls">
          <select>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="60m">1 hour</option>
            <option value="all">All</option>
          </select>
          <button className="btn-glass">Zoom +</button>
          <button className="btn-glass">Zoom -</button>
          <button className="btn-glass">Reset</button>
          <label>
            <input type="checkbox" /> Cluster
          </label>
        </div>
        <div ref={timelineContainerRef} className="timeline-container">
          <canvas ref={timelineCanvasRef} width="800" height="400"></canvas>
        </div>
      </div>
      
      {/* Results Panel */}
      <div className="results-panel glass">
        <h3>
          Results ({emails.length})
          {siteWideMode && (
            <span className="exploration-info" title="Site-Wide exploration; depth {depthLimit}, pages/domain/cycle {maxPagesPerDomainPerCycle}">
              🌐 Site-Wide Mode
            </span>
          )}
        </h3>
        
        <div className="results-controls">
          <button onClick={copyAllEmails} className="btn-glass">
            Copy All Emails
          </button>
          <button onClick={exportCSV} className="btn-glass">
            Export CSV
          </button>
          <button onClick={exportJSON} className="btn-glass">
            Export JSON
          </button>
        </div>
        
        <div className="results-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Domain</th>
                <th>Page Title</th>
                <th>Source URL</th>
                <th>Engine</th>
                <th>Snippet</th>
                <th>Fetched At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email, index) => (
                <tr key={index}>
                  <td>{email.email}</td>
                  <td>
                    <span className="domain-chip">
                      {email.domain}
                    </span>
                  </td>
                  <td>{email.title}</td>
                  <td>
                    <a href={email.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {email.sourceUrl}
                    </a>
                  </td>
                  <td>{email.engine}</td>
                  <td>{email.snippet}</td>
                  <td>{new Date(email.fetchedAt).toLocaleString()}</td>
                  <td>
                    <button 
                      onClick={() => navigator.clipboard.writeText(email.email)}
                      className="btn-glass"
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Phone & WhatsApp Results */}
      {extractPhones && (phones.length > 0 || whatsapp.length > 0) && (
        <div className="results-panel glass">
          <h3>📞 Phones & WhatsApp ({phones.length + whatsapp.length})</h3>
          
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
                a.download = `phones-whatsapp-${new Date().toISOString().split('T')[0]}.csv`;
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
      
      {/* Preset Modal */}
      {showPresetModal && (
        <div className="modal-overlay">
          <div className="modal glass">
            <h3>Save Keywords as Preset</h3>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name..."
            />
            <div className="modal-controls">
              <button onClick={saveCurrentAsPreset} className="btn-glass">
                Save
              </button>
              <button onClick={() => setShowPresetModal(false)} className="btn-glass">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCompanyEmailsFinder;
