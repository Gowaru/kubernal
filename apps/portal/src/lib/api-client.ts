import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl: string = error.config?.url ?? '';
      const isAuthRoute = requestUrl.startsWith('/auth/');
      const isLoginPage = window.location.pathname === '/login';
      if (!isAuthRoute && !isLoginPage) {
        window.location.href = '/login?expired=true';
      }
      const errData = error.response?.data?.error;
      const message =
        typeof errData === 'string' ? errData : errData?.message || 'Identifiants incorrects';
      return Promise.reject(new Error(message));
    }
    const errData = error.response?.data?.error;
    const message =
      typeof errData === 'string'
        ? errData
        : errData?.message || error.message || 'Erreur inconnue';
    return Promise.reject(new Error(message));
  },
);

export default apiClient;
