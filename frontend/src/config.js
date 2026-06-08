// Environment configuration
export const config = {
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:5003',
  UPLOAD_DIR: import.meta.env.VITE_UPLOAD_DIR || '/uploads',
  
  // Application Configuration
  ENV: import.meta.env.VITE_ENV || 'development',
  JWT_KEY: import.meta.env.VITE_JWT_KEY || 'jwt_token',
  DEFAULT_LANGUAGE: import.meta.env.VITE_DEFAULT_LANGUAGE || 'en',
  
  // External Services (optional)
  GOOGLE_MAPS_KEY: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
  
  // API Endpoints
  ENDPOINTS: {
    EMAIL_CHECK: '/api/checks',
    JOBS: '/api/jobs',
    FILES: '/api/files',
    CONFIG: '/api/config',
    HEALTH: '/health'
  },
  
  // Request Configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  // UI Configuration
  ITEMS_PER_PAGE: 10,
  DEBOUNCE_DELAY: 500, // milliseconds
};

// Helper functions
export const isDevelopment = () => config.ENV === 'development';
export const isProduction = () => config.ENV === 'production';

// API URL helpers
export const getApiUrl = (endpoint = '') => {
  const baseUrl = config.API_URL.endsWith('/') ? config.API_URL.slice(0, -1) : config.API_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

export const getUploadUrl = (filename = '') => {
  const uploadDir = config.UPLOAD_DIR.endsWith('/') ? config.UPLOAD_DIR : `${config.UPLOAD_DIR}/`;
  return `${config.API_URL}${uploadDir}${filename}`;
};

export default config;
