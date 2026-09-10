// Utilitaires autour de la Push API du navigateur (Web Push côté client).
// Vus que le service worker (public/sw.js) est enregistré sur la racine du
// site ; ces fonctions sont utilisées par PushContext.

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Les notifications push exigent un contexte sécurisé (HTTPS), sauf
// localhost en développement.
export function isSecureContext() {
  if (!window.isSecureContext) {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }
  return true;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const SW_URL = `${import.meta.env.BASE_URL || '/'}sw.js`;

export async function getServiceWorkerRegistration() {
  return navigator.serviceWorker.register(SW_URL);
}

export async function getBrowserSubscription() {
  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export async function createBrowserSubscription(vapidPublicKey) {
  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

export async function requestPermission() {
  return Notification.requestPermission();
}

// Court libellé du terminal (plateforme + navigateur) pour la gestion
// des tokens côté serveur.
export function deviceLabel() {
  try {
    const ua = navigator.userAgent || '';
    let platform = 'Appareil';
    try {
      if (navigator.userAgentData?.platform) platform = navigator.userAgentData.platform;
      else if (navigator.platform) platform = navigator.platform;
    } catch {
      /* silencieux */
    }
    const m = ua.match(/\(([^)]*)\)/);
    if (m && m[1]) platform = m[1];
    let browser = '';
    if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    return [platform, browser].filter(Boolean).join(' · ') || 'Appareil';
  } catch {
    return 'Appareil';
  }
}

export function formatEndpoint(endpoint) {
  if (!endpoint) return '';
  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch {
    return endpoint.slice(0, 40) + '…';
  }
}