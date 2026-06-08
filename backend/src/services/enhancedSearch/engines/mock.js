/**
 * Mock Engine for Enhanced Search
 * Provides static test data for multi-country keywords search
 */

class MockEngine {
  constructor() {
    this.name = 'Mock Engine (Testing)';
    this.mockResults = {
      'Saudi Arabia': [
        // SABIC Jobs - Multiple positions
        {
          title: 'Senior Software Engineer - SABIC Careers',
          url: 'https://sabic.com/careers/senior-software-engineer',
          domain: 'sabic.com',
          snippet: 'Senior Software Engineer position at SABIC in Riyadh, Saudi Arabia. Lead development of innovative solutions.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['engineer', 'software', 'senior'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Manager - SABIC Jobs',
          url: 'https://sabic.com/jobs/hr-manager',
          domain: 'sabic.com',
          snippet: 'HR Manager role at SABIC in Riyadh, Saudi Arabia. Manage human resources and employee relations.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['hr', 'manager'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Data Scientist - SABIC Innovation',
          url: 'https://sabic.com/careers/data-scientist',
          domain: 'sabic.com',
          snippet: 'Data Scientist position at SABIC in Jubail, Saudi Arabia. Apply AI and machine learning to industrial processes.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['scientist', 'data', 'ai'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Project Manager - SABIC Projects',
          url: 'https://sabic.com/jobs/project-manager',
          domain: 'sabic.com',
          snippet: 'Project Manager role at SABIC in Yanbu, Saudi Arabia. Lead major petrochemical projects.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['manager', 'project'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Process Engineer - SABIC Operations',
          url: 'https://sabic.com/careers/process-engineer',
          domain: 'sabic.com',
          snippet: 'Process Engineer position at SABIC in Al-Jubail, Saudi Arabia. Optimize manufacturing processes.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['engineer', 'process'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Financial Analyst - SABIC Finance',
          url: 'https://sabic.com/careers/financial-analyst',
          domain: 'sabic.com',
          snippet: 'Financial Analyst role at SABIC in Riyadh, Saudi Arabia. Analyze financial performance and market trends.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['analyst', 'financial'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Marketing Specialist - SABIC Marketing',
          url: 'https://sabic.com/careers/marketing-specialist',
          domain: 'sabic.com',
          snippet: 'Marketing Specialist position at SABIC in Jeddah, Saudi Arabia. Develop marketing strategies for petrochemical products.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['marketing', 'specialist'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Quality Engineer - SABIC Quality',
          url: 'https://sabic.com/careers/quality-engineer',
          domain: 'sabic.com',
          snippet: 'Quality Engineer role at SABIC in Dammam, Saudi Arabia. Ensure product quality and compliance.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['engineer', 'quality'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Sales Manager - SABIC Sales',
          url: 'https://sabic.com/jobs/sales-manager',
          domain: 'sabic.com',
          snippet: 'Sales Manager position at SABIC in Riyadh, Saudi Arabia. Lead sales team and drive revenue growth.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['manager', 'sales'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'IT Specialist - SABIC Technology',
          url: 'https://sabic.com/careers/it-specialist',
          domain: 'sabic.com',
          snippet: 'IT Specialist role at SABIC in Dhahran, Saudi Arabia. Support IT infrastructure and digital transformation.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['specialist', 'it', 'technology'],
          fetchedAt: new Date().toISOString()
        },
        // Aramco Jobs - Multiple positions
        {
          title: 'Senior Petroleum Engineer - Aramco',
          url: 'https://aramco.com/careers/senior-petroleum-engineer',
          domain: 'aramco.com',
          snippet: 'Senior Petroleum Engineer position at Aramco in Dhahran, Saudi Arabia. Lead oil and gas exploration projects.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['engineer', 'petroleum', 'senior'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Data Analyst - Aramco Digital',
          url: 'https://aramco.com/careers/data-analyst',
          domain: 'aramco.com',
          snippet: 'Data Analyst position at Aramco in Dhahran, Saudi Arabia. Analyze business data and provide insights.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['analyst', 'data'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Business Partner - Aramco HR',
          url: 'https://aramco.com/careers/hr-business-partner',
          domain: 'aramco.com',
          snippet: 'HR Business Partner role at Aramco in Riyadh, Saudi Arabia. Partner with business units on HR strategies.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['hr', 'business', 'partner'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Project Manager - Aramco Projects',
          url: 'https://aramco.com/jobs/project-manager',
          domain: 'aramco.com',
          snippet: 'Project Manager position at Aramco in Jeddah, Saudi Arabia. Lead major infrastructure and energy projects.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['manager', 'project'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Mechanical Engineer - Aramco Engineering',
          url: 'https://aramco.com/careers/mechanical-engineer',
          domain: 'aramco.com',
          snippet: 'Mechanical Engineer role at Aramco in Yanbu, Saudi Arabia. Design and maintain mechanical systems.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['engineer', 'mechanical'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Financial Controller - Aramco Finance',
          url: 'https://aramco.com/careers/financial-controller',
          domain: 'aramco.com',
          snippet: 'Financial Controller position at Aramco in Dhahran, Saudi Arabia. Oversee financial operations and reporting.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['controller', 'financial'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Environmental Engineer - Aramco Environment',
          url: 'https://aramco.com/careers/environmental-engineer',
          domain: 'aramco.com',
          snippet: 'Environmental Engineer role at Aramco in Jubail, Saudi Arabia. Ensure environmental compliance and sustainability.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['engineer', 'environmental'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Supply Chain Manager - Aramco Supply Chain',
          url: 'https://aramco.com/jobs/supply-chain-manager',
          domain: 'aramco.com',
          snippet: 'Supply Chain Manager position at Aramco in Dammam, Saudi Arabia. Optimize supply chain operations.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['manager', 'supply', 'chain'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'IT Security Specialist - Aramco Cybersecurity',
          url: 'https://aramco.com/careers/it-security-specialist',
          domain: 'aramco.com',
          snippet: 'IT Security Specialist role at Aramco in Riyadh, Saudi Arabia. Protect digital assets and infrastructure.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['specialist', 'security', 'cybersecurity'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Business Analyst - Aramco Strategy',
          url: 'https://aramco.com/careers/business-analyst',
          domain: 'aramco.com',
          snippet: 'Business Analyst position at Aramco in Dhahran, Saudi Arabia. Analyze business processes and recommend improvements.',
          engine: 'mock',
          country: 'Saudi Arabia',
          matchedKeywords: ['analyst', 'business'],
          fetchedAt: new Date().toISOString()
        }
      ],
      'United Arab Emirates': [
        {
          title: 'Senior Developer - Emirates NBD',
          url: 'https://emiratesnbd.com/careers/senior-developer',
          domain: 'emiratesnbd.com',
          snippet: 'Senior Developer position at Emirates NBD in Dubai, UAE. Experience with modern web technologies required.',
          engine: 'mock',
          country: 'United Arab Emirates',
          matchedKeywords: ['developer', 'senior'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Marketing Specialist - Etisalat',
          url: 'https://etisalat.ae/careers/marketing-specialist',
          domain: 'etisalat.ae',
          snippet: 'Marketing Specialist role at Etisalat in Abu Dhabi, UAE. Develop marketing strategies and campaigns.',
          engine: 'mock',
          country: 'United Arab Emirates',
          matchedKeywords: ['marketing', 'specialist'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Manager - ADNOC',
          url: 'https://adnoc.ae/careers/hr-manager',
          domain: 'adnoc.ae',
          snippet: 'HR Manager position at ADNOC in Abu Dhabi, UAE. Lead human resources initiatives.',
          engine: 'mock',
          country: 'United Arab Emirates',
          matchedKeywords: ['hr', 'manager'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Project Manager - DP World',
          url: 'https://dpworld.com/careers/project-manager',
          domain: 'dpworld.com',
          snippet: 'Project Manager role at DP World in Dubai, UAE. Lead logistics and port operations projects.',
          engine: 'mock',
          country: 'United Arab Emirates',
          matchedKeywords: ['manager', 'project'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Data Analyst - Emirates Airlines',
          url: 'https://emirates.com/careers/data-analyst',
          domain: 'emirates.com',
          snippet: 'Data Analyst position at Emirates Airlines in Dubai, UAE. Analyze passenger and operational data.',
          engine: 'mock',
          country: 'United Arab Emirates',
          matchedKeywords: ['analyst', 'data'],
          fetchedAt: new Date().toISOString()
        }
      ],
      'Qatar': [
        {
          title: 'Project Manager - QNB',
          url: 'https://qnb.com/careers/project-manager',
          domain: 'qnb.com',
          snippet: 'Project Manager position at QNB in Doha, Qatar. Lead major infrastructure projects.',
          engine: 'mock',
          country: 'Qatar',
          matchedKeywords: ['manager', 'project'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Specialist - Qatar Airways',
          url: 'https://qatarairways.com/careers/hr-specialist',
          domain: 'qatarairways.com',
          snippet: 'HR Specialist position at Qatar Airways in Doha, Qatar. Support employee relations and development.',
          engine: 'mock',
          country: 'Qatar',
          matchedKeywords: ['hr', 'specialist'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Engineer - Qatargas',
          url: 'https://qatargas.com/careers/engineer',
          domain: 'qatargas.com',
          snippet: 'Engineer position at Qatargas in Doha, Qatar. Work on LNG production and processing.',
          engine: 'mock',
          country: 'Qatar',
          matchedKeywords: ['engineer'],
          fetchedAt: new Date().toISOString()
        }
      ],
      'Kuwait': [
        {
          title: 'Financial Analyst - KFH',
          url: 'https://kfh.com/careers/financial-analyst',
          domain: 'kfh.com',
          snippet: 'Financial Analyst position at KFH in Kuwait City, Kuwait. Analyze financial data and trends.',
          engine: 'mock',
          country: 'Kuwait',
          matchedKeywords: ['analyst', 'financial'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Manager - Kuwait Petroleum',
          url: 'https://kpc.com.kw/careers/hr-manager',
          domain: 'kpc.com.kw',
          snippet: 'HR Manager position at Kuwait Petroleum Corporation in Kuwait City, Kuwait.',
          engine: 'mock',
          country: 'Kuwait',
          matchedKeywords: ['hr', 'manager'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Engineer - Kuwait Airways',
          url: 'https://kuwaitairways.com/careers/engineer',
          domain: 'kuwaitairways.com',
          snippet: 'Engineer position at Kuwait Airways in Kuwait City, Kuwait.',
          engine: 'mock',
          country: 'Kuwait',
          matchedKeywords: ['engineer'],
          fetchedAt: new Date().toISOString()
        }
      ],
      'Bahrain': [
        {
          title: 'Sales Executive - Bapco',
          url: 'https://bapco.com/careers/sales-executive',
          domain: 'bapco.com',
          snippet: 'Sales Executive position at Bapco in Manama, Bahrain. Drive sales growth and customer relationships.',
          engine: 'mock',
          country: 'Bahrain',
          matchedKeywords: ['sales', 'executive'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Specialist - Bahrain Petroleum',
          url: 'https://bapco.com/careers/hr-specialist',
          domain: 'bapco.com',
          snippet: 'HR Specialist position at Bapco in Manama, Bahrain. Support human resources operations.',
          engine: 'mock',
          country: 'Bahrain',
          matchedKeywords: ['hr', 'specialist'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Engineer - Gulf Air',
          url: 'https://gulfair.com/careers/engineer',
          domain: 'gulfair.com',
          snippet: 'Engineer position at Gulf Air in Manama, Bahrain. Aircraft maintenance and engineering.',
          engine: 'mock',
          country: 'Bahrain',
          matchedKeywords: ['engineer'],
          fetchedAt: new Date().toISOString()
        }
      ],
      'Oman': [
        {
          title: 'Operations Manager - PDO',
          url: 'https://pdo.co.om/careers/operations-manager',
          domain: 'pdo.co.om',
          snippet: 'Operations Manager position at PDO in Muscat, Oman. Manage daily operations and processes.',
          engine: 'mock',
          country: 'Oman',
          matchedKeywords: ['manager', 'operations'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'HR Manager - Oman Air',
          url: 'https://omanair.com/careers/hr-manager',
          domain: 'omanair.com',
          snippet: 'HR Manager position at Oman Air in Muscat, Oman. Lead human resources initiatives.',
          engine: 'mock',
          country: 'Oman',
          matchedKeywords: ['hr', 'manager'],
          fetchedAt: new Date().toISOString()
        },
        {
          title: 'Project Engineer - Orpic',
          url: 'https://orpic.com/careers/project-engineer',
          domain: 'orpic.com',
          snippet: 'Project Engineer position at Orpic in Muscat, Oman. Lead refinery and petrochemical projects.',
          engine: 'mock',
          country: 'Oman',
          matchedKeywords: ['engineer', 'project'],
          fetchedAt: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Searches for job postings (returns mock data)
   * @param {string} query - Search query
   * @param {number} maxPages - Maximum pages to search
   * @param {string} country - Country context
   * @returns {Promise<Array<Object>>} Mock search results
   */
  async search(query, maxPages = 2, country = '') {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Extract keywords from query (remove country/location terms)
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(' ').filter(word => 
      !['saudi', 'ksa', 'arabia', 'السعودية', 'riyadh', 'jeddah', 'dammam', 'الرياض', 'جدة', 'الدمام',
        'uae', 'emirates', 'dubai', 'abu', 'dhabi', 'الإمارات', 'دبي', 'أبو ظبي',
        'qatar', 'قطر', 'doha', 'الدوحة',
        'kuwait', 'الكويت', 'kuwait city', 'مدينة الكويت',
        'bahrain', 'البحرين', 'manama', 'المنامة',
        'oman', 'عمان', 'muscat', 'مسقط'].includes(word)
    );
    
    // Get results for the specified country or all countries
    let results = [];
    if (country && this.mockResults[country]) {
      results = this.mockResults[country];
    } else {
      // Return results from all countries
      Object.values(this.mockResults).forEach(countryResults => {
        results.push(...countryResults);
      });
    }
    
    // Filter results based on keywords
    if (keywords.length > 0) {
      results = results.filter(result => {
        const searchText = `${result.title} ${result.snippet}`.toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword));
      });
    }
    
    // Limit results based on maxPages (simulate pagination)
    const maxResults = maxPages * 5; // 5 results per page
    return results.slice(0, Math.min(maxResults, results.length));
  }

  /**
   * Checks if the engine is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return true; // Mock engine is always available
  }
}

export default new MockEngine();
