import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './DomainEmailsFinder.css';

const API_BASE = 'http://localhost:5003/api/domain-emails';

const DomainEmailsFinder = ({ embedded = false }) => {
  const [domains, setDomains] = useState('stc.com\nsabic.com\naramco.com');
  const [depthLimit, setDepthLimit] = useState(3);
  const [maxPagesPerDomain, setMaxPagesPerDomain] = useState(50);
  const [onlyTargetDomain, setOnlyTargetDomain] = useState(false);
  const [excludeFreeWebmail, setExcludeFreeWebmail] = useState(true);

  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState(null);
  const [emails, setEmails] = useState([]);
  const [pagesVisited, setPagesVisited] = useState(0);
  const [currentPage, setCurrentPage] = useState('');
  const [errors, setErrors] = useState(0);
  const [filterText, setFilterText] = useState('');

  const eventSourceRef = useRef(null);

  const stopSearch = useCallback(async () => {
    if (runId) {
      try {
        await fetch(`${API_BASE}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId })
        });
      } catch (e) {
        console.warn('Stop failed:', e);
      }
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
  }, [runId]);

  const startSearch = useCallback(async () => {
    const domainList = domains.split('\n').map(d => d.trim()).filter(Boolean);
    if (domainList.length === 0) {
      alert('أدخل دومين واحد على الأقل');
      return;
    }

    await stopSearch();
    setEmails([]);
    setPagesVisited(0);
    setCurrentPage('');
    setErrors(0);
    setIsRunning(true);

    try {
      const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domains: domainList,
          depthLimit,
          maxPagesPerDomain,
          onlyTargetDomain,
          excludeFreeWebmail
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'فشل بدء البحث');
        setIsRunning(false);
        return;
      }

      setRunId(data.runId);

      const eventSource = new EventSource(`${API_BASE}/stream/${data.runId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'result') {
          setEmails(prev => {
            if (prev.some(e => e.email === msg.email && e.sourceUrl === msg.sourceUrl)) {
              return prev;
            }
            return [...prev, msg];
          });
        } else if (msg.type === 'page') {
          setCurrentPage(msg.url);
          setPagesVisited(msg.pagesVisited);
        } else if (msg.type === 'progress') {
          if (msg.pagesVisited) setPagesVisited(msg.pagesVisited);
          if (msg.totalEmails !== undefined) {
            // progress update
          }
        } else if (msg.type === 'done') {
          setIsRunning(false);
          eventSource.close();
          eventSourceRef.current = null;
        } else if (msg.type === 'error') {
          alert(msg.message);
          setIsRunning(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setIsRunning(false);
        eventSource.close();
        eventSourceRef.current = null;
      };
    } catch (error) {
      alert(`خطأ: ${error.message}`);
      setIsRunning(false);
    }
  }, [domains, depthLimit, maxPagesPerDomain, onlyTargetDomain, excludeFreeWebmail, stopSearch]);

  const exportCSV = () => {
    if (emails.length === 0) return;
    const rows = emails.map(e => ({
      Email: e.email,
      Domain: e.domain,
      'Target Domain': e.targetDomain,
      'Matches Target': e.matchesTarget ? 'Yes' : 'No',
      'Source URL': e.sourceUrl,
      'Page Title': e.pageTitle,
      Snippet: e.snippet,
      'Fetched At': e.fetchedAt
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Domain Emails');
    XLSX.writeFile(wb, 'domain_emails_results.csv');
  };

  const copyEmails = async () => {
    const list = filteredEmails.map(e => e.email).join('\n');
    try {
      await navigator.clipboard.writeText(list);
      alert(`تم نسخ ${filteredEmails.length} إيميل`);
    } catch {
      alert('فشل النسخ');
    }
  };

  const filteredEmails = emails.filter(e => {
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    return (
      e.email.toLowerCase().includes(search) ||
      e.domain.toLowerCase().includes(search) ||
      e.sourceUrl.toLowerCase().includes(search) ||
      (e.snippet || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className={`domain-emails-finder ${embedded ? 'embedded' : ''}`}>
      <div className="def-config">
        {!embedded && (
          <p className="def-description">
            أدخل دومين أو أكثر وسيتم زحف الموقع بالكامل واستخراج كل الإيميلات الموجودة فيه
          </p>
        )}

        <div className="def-form">
          <div className="input-group">
            <label>الدومينات (واحد في كل سطر)</label>
            <textarea
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              rows={5}
              placeholder="example.com&#10;company.sa&#10;https://www.site.com"
              disabled={isRunning}
              className="glass-textarea"
            />
          </div>

          <div className="def-options">
            <div className="input-group">
              <label>عمق الزحف (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={depthLimit}
                onChange={(e) => setDepthLimit(Math.min(5, Math.max(1, parseInt(e.target.value) || 3)))}
                disabled={isRunning}
                className="glass-input"
              />
            </div>
            <div className="input-group">
              <label>أقصى صفحات لكل دومين</label>
              <input
                type="number"
                min={5}
                max={200}
                value={maxPagesPerDomain}
                onChange={(e) => setMaxPagesPerDomain(Math.min(200, Math.max(5, parseInt(e.target.value) || 50)))}
                disabled={isRunning}
                className="glass-input"
              />
            </div>
          </div>

          <div className="def-toggles">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={onlyTargetDomain}
                onChange={(e) => setOnlyTargetDomain(e.target.checked)}
                disabled={isRunning}
              />
              <span>إيميلات الدومين فقط (@example.com)</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={excludeFreeWebmail}
                onChange={(e) => setExcludeFreeWebmail(e.target.checked)}
                disabled={isRunning}
              />
              <span>استبعاد Gmail / Yahoo / Hotmail</span>
            </label>
          </div>

          <div className="def-actions">
            <button
              className="btn btn-primary"
              onClick={startSearch}
              disabled={isRunning}
            >
              {isRunning ? '⏳ جاري الزحف...' : '🔍 استخراج الإيميلات'}
            </button>
            {isRunning && (
              <button className="btn btn-secondary" onClick={stopSearch}>
                ⏹️ إيقاف
              </button>
            )}
            <button
              className="btn btn-glass"
              onClick={() => { setEmails([]); setPagesVisited(0); }}
              disabled={isRunning}
            >
              🗑️ مسح
            </button>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="def-progress">
          <p>📄 الصفحات المزارة: <strong>{pagesVisited}</strong></p>
          <p>📧 الإيميلات المكتشفة: <strong>{emails.length}</strong></p>
          {currentPage && (
            <p className="def-current-page">جاري: {currentPage}</p>
          )}
        </div>
      )}

      {emails.length > 0 && (
        <div className="def-results">
          <div className="def-results-header">
            <h3>📧 النتائج ({filteredEmails.length} من {emails.length})</h3>
            <div className="def-results-actions">
              <input
                type="text"
                placeholder="بحث..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="glass-input def-filter"
              />
              <button className="btn btn-glass" onClick={copyEmails}>📋 نسخ الإيميلات</button>
              <button className="btn btn-glass" onClick={exportCSV}>📊 تصدير CSV</button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="def-table">
              <thead>
                <tr>
                  <th>الإيميل</th>
                  <th>الدومين</th>
                  <th>يطابق الهدف</th>
                  <th>الصفحة المصدر</th>
                  <th>مقتطف</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmails.map((item, i) => (
                  <tr key={`${item.email}-${item.sourceUrl}-${i}`}>
                    <td className="def-email">{item.email}</td>
                    <td>{item.domain}</td>
                    <td>
                      <span className={`chip ${item.matchesTarget ? 'chip-success' : 'chip-info'}`}>
                        {item.matchesTarget ? '✓ نعم' : 'لا'}
                      </span>
                    </td>
                    <td>
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {item.sourceUrl}
                      </a>
                    </td>
                    <td className="def-snippet">{item.snippet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainEmailsFinder;
