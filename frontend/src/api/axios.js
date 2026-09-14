import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const baseURL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const api = axios.create({
  baseURL,
});

function roleFromToken() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function getSiteOverride() {
  const v = localStorage.getItem('siteOverride');
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function setSiteOverride(id) {
  if (id == null) {
    localStorage.removeItem('siteOverride');
  } else {
    localStorage.setItem('siteOverride', String(id));
  }
}

// Multi-sites : seul le superadmin (vision globale) peut filtrer via un site
// choisi dans le sélecteur. Le paramètre `site` est ajouté à chaque requête ;
// côté serveur il est ignoré pour tous les autres rôles (isolation stricte).
function applySiteParam(config) {
  if (roleFromToken() !== 'superadmin') return config;
  const site = getSiteOverride();
  if (site == null) return config;
  const sep = config.url.includes('?') ? '&' : '?';
  config.url += `${sep}site=${site}`;
  return config;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return applySiteParam(config);
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
