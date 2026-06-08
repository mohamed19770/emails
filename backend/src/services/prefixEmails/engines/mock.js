// Mock engine for testing and development
export async function runMock(query, maxPages = 2) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const results = [];
  
  // Generate mock results based on query parameters
  const mockCompanies = [
    'SABIC', 'Aramco', 'STC', 'Al Rajhi Bank', 'Samba Financial Group',
    'Emirates NBD', 'ADNOC', 'Qatar Airways', 'Kuwait Petroleum',
    'Bahrain Bourse', 'Oman Oil', 'Egyptian Exchange', 'Jordan Bank',
    'Lebanon Central Bank', 'Maaden', 'SNC', 'Tawuniya', 'Almarai',
    'Jarir', 'Al Hokair', 'ELM', 'Mobily', 'Zain', 'Etisalat',
    'Du', 'Vodafone', 'Orange', 'Mobinil', 'Ooredoo', 'Viva',
    'Batelco', 'Omantel', 'Renna', 'Qtel', 'Arab Bank', 'Cairo Bank',
    'NSGB', 'CIB', 'ADCB', 'FGB', 'RAK Bank', 'CBD', 'ADIB',
    'Mashreq', 'HSBC', 'SCB', 'Alinma Bank', 'Riyad Bank',
    'Banque Saudi Fransi', 'Arab National Bank', 'Saudi Investment Bank',
    'Al Bilad Bank', 'Saudi Hollandi Bank', 'Al Rajhi Capital',
    'NCB Capital', 'Falcom', 'Alinma Investment', 'Samba Capital'
  ];
  
  const mockTitles = [
    'Careers - Join Our Team',
    'HR Department - Contact Us',
    'Recruitment Opportunities',
    'Jobs and Careers',
    'Human Resources',
    'Talent Acquisition',
    'Career Development',
    'Employment Opportunities',
    'Work With Us',
    'Join Our Company',
    'Career Portal',
    'Job Openings',
    'Vacancy Announcements',
    'Employment Portal',
    'Career Center',
    'Job Board',
    'Recruitment Portal',
    'Career Opportunities',
    'Job Vacancies',
    'Employment Board',
    'Career Services',
    'Job Search',
    'Career Guidance',
    'Professional Development',
    'Career Growth',
    'Job Placement',
    'Career Counseling',
    'Employment Services',
    'Career Planning',
    'Job Market'
  ];
  
  const mockDomains = [
    'sabic.com', 'aramco.co', 'stc.com.sa', 'alrajhibank.com.sa',
    'samba.com', 'emiratesnbd.com', 'adnoc.ae', 'qatarairways.com',
    'kpc.com.kw', 'bahrainbourse.com', 'omanoil.om', 'egx.com.eg',
    'jordanbank.com', 'bdl.gov.lb', 'maaden.com.sa', 'snc.com.sa',
    'tawuniya.com.sa', 'almarai.com', 'jarir.com', 'alhokair.com',
    'elm.com.sa', 'mobily.com.sa', 'zain.com', 'etisalat.ae',
    'du.ae', 'etisalat.com.eg', 'vodafone.com.eg', 'orange.com.eg',
    'mobinil.com.eg', 'zain.com.kw', 'ooredoo.com.kw', 'viva.com.kw',
    'batelco.com.bh', 'zain.com.bh', 'viva.com.bh', 'omantel.om',
    'ooredoo.om', 'renna.om', 'qtel.com.qa', 'vodafone.qa',
    'ooredoo.qa', 'jordanbank.com', 'arab-bank.com', 'cairo-bank.com',
    'nsgb.com.eg', 'cib.com.eg', 'adcb.com', 'fgb.com',
    'rakbank.com', 'cbd.com', 'adib.com', 'mashreq.com',
    'hsbc.com.ae', 'scb.com.ae', 'rakbank.com', 'cbd.com',
    'alinma.com', 'riyadbank.com', 'bsf.com.sa', 'anb.com.sa',
    'sib.com.sa', 'bilad.com.sa', 'shb.com.sa', 'rajhicapital.com',
    'ncb.com.sa', 'falcom.com.sa', 'alinma.com.sa', 'sambacapital.com',
    'alrajhi.com', 'ncbc.com.sa', 'alrajhicapital.com', 'samba.com.sa',
    'alrajhibank.com', 'alrajhi.com.sa', 'alrajhi.sa', 'alrajhi.net',
    'alrajhi.org', 'alrajhi.info', 'alrajhi.biz', 'alrajhi.co',
    'alrajhi.me', 'alrajhi.io', 'alrajhi.ai', 'alrajhi.tech',
    'alrajhi.digital', 'alrajhi.online', 'alrajhi.website', 'alrajhi.site'
  ];
  
  // Generate results for each page
  for (let page = 1; page <= maxPages; page++) {
    const resultsPerPage = Math.floor(Math.random() * 15) + 10; // 10-25 results per page
    
    for (let i = 0; i < resultsPerPage; i++) {
      const company = mockCompanies[Math.floor(Math.random() * mockCompanies.length)];
      const title = mockTitles[Math.floor(Math.random() * mockTitles.length)];
      const domain = mockDomains[Math.floor(Math.random() * mockDomains.length)];
      
      // Generate random phone numbers for each result
      const phoneNumber = Math.floor(Math.random() * 9000000000) + 500000000; // 9-digit number starting with 5
      const fullPhone = `966${phoneNumber}`;
      const localPhone = `0${phoneNumber}`;
      
      // Create mock URL
      const url = `https://${domain}/${title.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Create mock snippet with email content
      const snippet = `Find career opportunities at ${company}. We are looking for talented individuals to join our team in ${query.country}. Contact us at hr@${domain} or careers@${domain}.`;
      
      results.push({
        title: `${title} - ${company}`,
        url,
        snippet,
        page,
        engine: 'mock',
        // Add mock HTML content with diverse emails
        htmlContent: `
          <html>
            <body>
              <h1>${title} - ${company}</h1>
              <p>Find career opportunities at ${company}. We are looking for talented individuals to join our team in ${query.country}.</p>
              <p>Contact us at:</p>
              <ul>
                <li>Phone: <a href="tel:+${fullPhone}">+${fullPhone}</a></li>
                <li>WhatsApp: <a href="https://wa.me/${fullPhone}">Chat with us</a></li>
                <li>Mobile: ${localPhone}</li>
                <li>hr@${domain}</li>
                <li>careers@${domain}</li>
                <li>recruitment@${domain}</li>
                <li>jobs@${domain}</li>
                <li>talent@${domain}</li>
                <li>hiring@${domain}</li>
                <li>people@${domain}</li>
                <li>employment@${domain}</li>
                <li>vacancies@${domain}</li>
                <li>opportunities@${domain}</li>
                <li>join@${domain}</li>
                <li>apply@${domain}</li>
                <li>resume@${domain}</li>
                <li>cv@${domain}</li>
                <li>contact@${domain}</li>
                <li>info@${domain}</li>
                <li>support@${domain}</li>
                <li>admin@${domain}</li>
                <li>management@${domain}</li>
                <li>executive@${domain}</li>
              </ul>
              <p>For more information, email us at info@${domain}</p>
              <p>Send your CV to cv@${domain} or apply@${domain}</p>
              <p>HR Department: hr@${domain}</p>
              <p>Recruitment Team: recruitment@${domain}</p>
            </body>
          </html>
        `
      });
    }
  }
  
  return results;
}
