export const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname ? `http://${window.location.hostname}:3001/api` : 'http://localhost:3001/api');
