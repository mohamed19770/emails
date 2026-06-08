// Mock engine for industry domain testing and development
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
    'Company Website - Official Site',
    'Home - Corporate Website',
    'About Us - Company Information',
    'Contact Us - Get in Touch',
    'Services - What We Offer',
    'Products - Our Solutions',
    'Careers - Join Our Team',
    'News - Latest Updates',
    'Investors - Financial Information',
    'Sustainability - Our Commitment'
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
    'ncb.com.sa', 'falcom.com.sa', 'alinma.com.sa', 'sambacapital.com'
  ];
  
  // Generate results for each page
  for (let page = 1; page <= maxPages; page++) {
    const resultsPerPage = Math.floor(Math.random() * 8) + 5; // 5-12 results per page
    
    for (let i = 0; i < resultsPerPage; i++) {
      const company = mockCompanies[Math.floor(Math.random() * mockCompanies.length)];
      const title = mockTitles[Math.floor(Math.random() * mockTitles.length)];
      const domain = mockDomains[Math.floor(Math.random() * mockDomains.length)];
      
      // Create mock URL
      const url = `https://${domain}/${title.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Create mock snippet with industry-specific content
      const snippet = `${company} is a leading company in ${query.industryKeyword} sector. We provide innovative solutions and services to our clients in ${query.country}. Contact us for more information.`;
      
      results.push({
        title: `${title} - ${company}`,
        url,
        snippet,
        page,
        engine: 'mock',
        industryKeyword: query.industryKeyword,
        country: query.country
      });
    }
  }
  
  return results;
}

