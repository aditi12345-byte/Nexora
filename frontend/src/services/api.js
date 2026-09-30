import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('folio_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
      localStorage.removeItem('folio_token');
      localStorage.removeItem('folio_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  const apiMessage = error?.response?.data?.error?.message;
  const details = error?.response?.data?.error?.details;
  const detailText = Array.isArray(details)
    ? details.map((item) => item?.message).filter(Boolean).join(' ')
    : '';
  if (apiMessage && detailText) return `${apiMessage} ${detailText}`;
  if (apiMessage) return apiMessage;
  const status = error?.response?.status;
  if (status) return `The server rejected the request (${status}).`;
  return 'The API could not be reached.';
}

export function errorDetails(error) {
  return error?.response?.data?.error?.details || [];
}

export default api;
