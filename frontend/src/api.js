import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: window.location.origin, // Force using current origin to rely on Vite proxy
  timeout: 300000, // 5 minutes for large email lists
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    console.log(`Full URL: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Response error:', error);
    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait before trying again.');
    }
    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try with fewer emails.');
    }
    return Promise.reject(error);
  }
);

// Email checker API
export const emailCheckerApi = {
  // Run email validation
  runChecks: async (emails, safeMode = false) => {
    const response = await api.post('/api/email-checker/run', {
      emails,
      safeMode
    });
    return response.data;
  },
  // Alias for backward compatibility
  runEmailCheck: async (emails, safeMode = false) => {
    return emailCheckerApi.runChecks(emails, safeMode);
  }
};

// Export individual functions for easier imports
export const runEmailCheck = emailCheckerApi.runEmailCheck;
export const runChecks = emailCheckerApi.runChecks;

export default api;