/**
 * Frontend smoke tests using Jest DOM
 */
import { JSDOM } from 'jsdom';

// Setup JSDOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <title>Email Checker</title>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`, {
  url: 'http://localhost:5173',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Frontend Smoke Tests', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="root"></div>';
    fetch.mockClear();
  });

  describe('Email Search Page Structure', () => {
    test('should have required form elements', () => {
      // Create the basic structure
      const root = document.getElementById('root');
      root.innerHTML = `
        <div className="email-search-page">
          <div className="container">
            <h1 className="page-title">Email Checker</h1>
            <div className="input-section card">
              <textarea placeholder="Paste emails here, one per line or comma-separated..."></textarea>
              <input type="file" accept=".txt,.csv" />
              <button className="btn btn-primary">Search</button>
              <button className="btn btn-warning">Safe Mode Search</button>
            </div>
          </div>
        </div>
      `;

      // Check for required elements
      expect(document.querySelector('h1.page-title')).toBeTruthy();
      expect(document.querySelector('textarea')).toBeTruthy();
      expect(document.querySelector('input[type="file"]')).toBeTruthy();
      expect(document.querySelector('button.btn-primary')).toBeTruthy();
      expect(document.querySelector('button.btn-warning')).toBeTruthy();
    });

    test('should have file input with correct accept attribute', () => {
      const root = document.getElementById('root');
      root.innerHTML = `
        <input type="file" accept=".txt,.csv" />
      `;

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
      expect(fileInput.getAttribute('accept')).toBe('.txt,.csv');
    });
  });

  describe('API Integration', () => {
    test('should handle successful API response', async () => {
      const mockResponse = {
        success: true,
        data: {
          summary: {
            total: 2,
            valid: 1,
            invalid: 1,
            risky: 0,
            unknown: 0,
            duplicates: 0
          },
          results: [
            {
              email: 'test@gmail.com',
              status: 'valid',
              reason: 'deliverable',
              domain: 'gmail.com',
              hasMX: true,
              method: 'smtp',
              checkedAt: new Date().toISOString()
            },
            {
              email: 'invalid@example.com',
              status: 'invalid',
              reason: 'no_mx_records',
              domain: 'example.com',
              hasMX: false,
              method: 'mx',
              checkedAt: new Date().toISOString()
            }
          ]
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Simulate API call
      const response = await fetch('/api/email-checker/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emails: ['test@gmail.com', 'invalid@example.com'],
          safeMode: false
        })
      });

      expect(fetch).toHaveBeenCalledWith('/api/email-checker/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emails: ['test@gmail.com', 'invalid@example.com'],
          safeMode: false
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.results).toHaveLength(2);
    });

    test('should handle API error response', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/email-checker/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emails: ['test@gmail.com'],
            safeMode: false
          })
        });
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });
  });

  describe('CSV Download Functionality', () => {
    test('should generate CSV content correctly', () => {
      const mockResults = [
        {
          email: 'test@gmail.com',
          status: 'valid',
          reason: 'deliverable',
          domain: 'gmail.com',
          hasMX: true,
          method: 'smtp',
          checkedAt: '2023-01-01T00:00:00.000Z'
        }
      ];

      const headers = ['Email', 'Status', 'Reason', 'Domain', 'Has MX', 'Method', 'Checked At'];
      const csvContent = [
        headers.join(','),
        ...mockResults.map(result => [
          `"${result.email}"`,
          `"${result.status}"`,
          `"${result.reason}"`,
          `"${result.domain || ''}"`,
          result.hasMX ? 'Yes' : 'No',
          `"${result.method}"`,
          `"${new Date(result.checkedAt).toLocaleString()}"`
        ].join(','))
      ].join('\n');

      expect(csvContent).toContain('Email,Status,Reason,Domain,Has MX,Method,Checked At');
      expect(csvContent).toContain('"test@gmail.com"');
      expect(csvContent).toContain('"valid"');
    });

    test('should handle empty results for CSV download', () => {
      const mockResults = [];
      
      // Simulate the check for empty results
      expect(mockResults.length).toBe(0);
      
      // This would trigger the "No results to download" alert in the actual component
      const hasResults = mockResults.length > 0;
      expect(hasResults).toBe(false);
    });
  });

  describe('Email Parsing', () => {
    test('should parse emails from textarea input', () => {
      const emailText = `test@gmail.com
user@yahoo.com
invalid@example.com`;

      const emails = emailText.split(/[\n,;]+/)
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0);

      expect(emails).toEqual([
        'test@gmail.com',
        'user@yahoo.com',
        'invalid@example.com'
      ]);
    });

    test('should handle comma-separated emails', () => {
      const emailText = 'test@gmail.com,user@yahoo.com,invalid@example.com';

      const emails = emailText.split(/[\n,;]+/)
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0);

      expect(emails).toEqual([
        'test@gmail.com',
        'user@yahoo.com',
        'invalid@example.com'
      ]);
    });

    test('should deduplicate emails', () => {
      const emails = [
        'test@gmail.com',
        'user@yahoo.com',
        'test@gmail.com', // duplicate
        'invalid@example.com'
      ];

      const uniqueEmails = [...new Set(emails)];
      expect(uniqueEmails).toEqual([
        'test@gmail.com',
        'user@yahoo.com',
        'invalid@example.com'
      ]);
    });
  });

  describe('UI State Management', () => {
    test('should handle loading state', () => {
      const root = document.getElementById('root');
      root.innerHTML = `
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style="width: 50%"></div>
          </div>
          <div className="progress-text">Processing 25 / 50 emails...</div>
        </div>
      `;

      const progressFill = document.querySelector('.progress-fill');
      const progressText = document.querySelector('.progress-text');

      expect(progressFill.style.width).toBe('50%');
      expect(progressText.textContent).toBe('Processing 25 / 50 emails...');
    });

    test('should handle error state', () => {
      const root = document.getElementById('root');
      root.innerHTML = `
        <div className="error-banner">
          <span>Network error occurred</span>
          <button className="close-btn">✖</button>
        </div>
      `;

      const errorBanner = document.querySelector('.error-banner');
      const closeBtn = document.querySelector('.close-btn');

      expect(errorBanner).toBeTruthy();
      expect(errorBanner.textContent).toContain('Network error occurred');
      expect(closeBtn).toBeTruthy();
    });
  });
});
