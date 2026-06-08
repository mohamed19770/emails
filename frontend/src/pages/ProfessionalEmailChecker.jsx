import React, { useState } from 'react';
import LiveCompanyEmailsFinder from '../components/LiveCompanyEmailsFinder';
import IndustryDomainFinder from '../components/IndustryDomainFinder';
import DomainEmailsFinder from '../components/DomainEmailsFinder';
import './ProfessionalEmailChecker.css';

const TOOLS = [
  {
    id: 'domain-crawl',
    icon: '🌐',
    title: 'زحف الدومين',
    titleEn: 'Domain Crawler',
    description: 'أدخل دومين واستخرج كل الإيميلات من صفحات الموقع'
  },
  {
    id: 'company-search',
    icon: '📧',
    title: 'بحث الشركات',
    titleEn: 'Company Search',
    description: 'ابحث عبر محركات البحث عن إيميلات الشركات حسب الكلمات والدول'
  },
  {
    id: 'industry-domains',
    icon: '🏢',
    title: 'دومينات الصناعة',
    titleEn: 'Industry Domains',
    description: 'اكتشف دومينات الشركات حسب القطاع والصناعة'
  }
];

const ProfessionalEmailChecker = () => {
  const [activeTool, setActiveTool] = useState('domain-crawl');

  const current = TOOLS.find(t => t.id === activeTool);

  return (
    <div className="professional-email-checker">
      <div className="container">
        <header className="page-header">
          <h1 className="page-title">أدوات البحث عن الإيميلات</h1>
          <p className="page-description">
            اختر الأداة المناسبة لمهمتك. للتحقق من صحة الإيميلات انتقل إلى{' '}
            <a href="/" className="page-link">Email Checker</a>.
          </p>
        </header>

        <nav className="tools-nav" aria-label="أدوات البحث">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              type="button"
              className={`tool-tab ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
              aria-pressed={activeTool === tool.id}
            >
              <span className="tool-tab-icon">{tool.icon}</span>
              <span className="tool-tab-text">
                <span className="tool-tab-title">{tool.title}</span>
                <span className="tool-tab-sub">{tool.titleEn}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="tool-panel card glass">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="tool-panel-icon">{current.icon}</span>
              <div>
                <h2>{current.title}</h2>
                <p>{current.description}</p>
              </div>
            </div>
          </div>

          <div className="tool-panel-body">
            {activeTool === 'domain-crawl' && <DomainEmailsFinder embedded />}
            {activeTool === 'company-search' && <LiveCompanyEmailsFinder embedded />}
            {activeTool === 'industry-domains' && <IndustryDomainFinder embedded />}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfessionalEmailChecker;
