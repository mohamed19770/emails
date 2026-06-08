import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import EmailSearchPage from './pages/EmailSearchPage.jsx';
import ProfessionalEmailChecker from './pages/ProfessionalEmailChecker.jsx';
import WhatsAppFinder from './components/WhatsAppFinder.jsx';
import RecruitmentWhatsAppFinder from './components/RecruitmentWhatsAppFinder.jsx';
import './App.css';

function App() {
  return (
    <div className="app">
      <nav className="navbar glass">
        <div className="navbar-container">
          <Link to="/" className="navbar-brand">
            📧 Email & WhatsApp Checker
          </Link>
          <div className="navbar-links">
            <Link to="/" className="navbar-link">Email Checker</Link>
            <Link to="/pro-checker" className="navbar-link">Professional Check</Link>
            <Link to="/whatsapp" className="navbar-link">WhatsApp Finder</Link>
            <Link to="/recruitment-whatsapp" className="navbar-link">Recruitment WhatsApp</Link>
          </div>
        </div>
      </nav>
      
      <Routes>
        <Route path="/" element={<EmailSearchPage />} />
        <Route path="/email-checker" element={<EmailSearchPage />} />
        <Route path="/pro-checker" element={<ProfessionalEmailChecker />} />
        <Route path="/whatsapp" element={<WhatsAppFinder />} />
        <Route path="/recruitment-whatsapp" element={<RecruitmentWhatsAppFinder />} />
      </Routes>
    </div>
  );
}

export default App;

