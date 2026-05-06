const STORAGE_KEY = 'ec_selected_center_id';

let currentCenterId = 'all';

export const getStoredCenterId = () => {
  if (typeof window === 'undefined') return 'all';
  return window.localStorage.getItem(STORAGE_KEY) || 'all';
};

export const setStoredCenterId = (centerId: string) => {
  currentCenterId = centerId || 'all';
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, currentCenterId);
  }
};

export const setCurrentCenterId = (centerId: string) => {
  currentCenterId = centerId || 'all';
};

export const getCurrentCenterId = () => currentCenterId;

export const shouldScopeApiUrl = (url: string, method?: string) => {
  const normalizedMethod = (method || 'GET').toUpperCase();
  if (normalizedMethod !== 'GET') return false;

  const path = url.split('?')[0];
  if (
    path === '/auth/me' ||
    path === '/centers' ||
    path.startsWith('/admin/') ||
    path.startsWith('/config/') ||
    path.startsWith('/branding/') ||
    path.startsWith('/modules/')
  ) {
    return false;
  }

  return [
    '/reporting/',
    '/leads',
    '/crm/pipeline',
    '/students',
    '/parents',
    '/families',
    '/academic/classes',
    '/commercial/contracts',
    '/commercial/payments',
    '/commercial/renewals',
  ].some((prefix) => path === prefix || path.startsWith(prefix));
};

export const withCenterScope = (url: string, method?: string) => {
  const centerId = getCurrentCenterId();
  if (!centerId || centerId === 'all' || !shouldScopeApiUrl(url, method)) return url;

  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  if (!params.has('centerId')) params.set('centerId', centerId);
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
};
