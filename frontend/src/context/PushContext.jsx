import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { pushService } from '../api/pushService';
import {
  isPushSupported,
  isSecureContext,
  getBrowserSubscription,
  createBrowserSubscription,
  requestPermission,
  deviceLabel,
} from '../utils/push';

const PushContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const PUSH_STATUS = {
  loading: 'loading',       // vérification en cours
  unsupported: 'unsupported', // navigateur / contexte non sécurisé
  disabled: 'disabled',     // backend non configuré (pas de VAPID)
  idle: 'idle',             // permission OK mais non abonné
  denied: 'denied',         // permission refusée (à réactiver dans le navigateur)
  subscribed: 'subscribed',
  error: 'error',
};

export function PushProvider({ children }) {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(PUSH_STATUS.loading);
  const [deviceSub, setDeviceSub] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const supported = isPushSupported() && isSecureContext();

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(PUSH_STATUS.idle);
      return;
    }
    if (!supported) {
      setStatus(PUSH_STATUS.unsupported);
      return;
    }

    try {
      const { data } = await pushService.config();
      setConfig(data);
      if (!data.enabled) {
        setStatus(PUSH_STATUS.disabled);
        return;
      }

      if (Notification.permission === 'denied') {
        setStatus(PUSH_STATUS.denied);
        return;
      }

      // Auto-réparation : si cet appareil est déjà abonné côté navigateur
      // (ex : session précédente), on resynchronise le token côté serveur.
      // L'upsert backend par endpoint garantit l'absence de doublon.
      let browserSub = null;
      try {
        browserSub = await getBrowserSubscription();
      } catch {
        browserSub = null;
      }

      if (browserSub) {
        const res = await pushService.subscribe(browserSub.toJSON(), deviceLabel());
        setDeviceSub(res.data?.subscription || null);
        setStatus(PUSH_STATUS.subscribed);
      } else {
        setStatus(PUSH_STATUS.idle);
      }
    } catch (e) {
      setStatus(PUSH_STATUS.error);
      setError(e?.response?.data?.message || e.message || 'Impossible de vérifier l\'état des notifications');
    }
  }, [user, supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (busy || !supported) return false;
    setBusy(true);
    setError(null);
    try {
      const permission = await requestPermission();
      if (permission !== 'granted') {
        setStatus(PUSH_STATUS.denied);
        return false;
      }

      const { data } = await pushService.config();
      setConfig(data);
      if (!data.enabled) {
        setStatus(PUSH_STATUS.disabled);
        return false;
      }

      let browserSub = await getBrowserSubscription();
      if (!browserSub) {
        browserSub = await createBrowserSubscription(data.vapidPublicKey);
      }

      const res = await pushService.subscribe(browserSub.toJSON(), deviceLabel());
      setDeviceSub(res.data?.subscription || null);
      setStatus(PUSH_STATUS.subscribed);
      return true;
    } catch (e) {
      setStatus(PUSH_STATUS.error);
      setError(e?.response?.data?.message || e.message || 'Échec de l\'abonnement aux notifications');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, supported]);

  const disable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Désabonne le token local (si l'appareil est abonné chez le navigateur)
      // puis le supprime côté serveur. En cas d'échec réseau, le token expirera
      // de lui-même (le serveur le purge sur 404/410).
      let browserSub = null;
      try {
        browserSub = await getBrowserSubscription();
      } catch {
        browserSub = null;
      }
      const endpoint = browserSub?.endpoint || deviceSub?.endpoint;
      if (endpoint) {
        try {
          await pushService.unsubscribe(endpoint);
        } catch {
          /* silencieux */
        }
      }
      if (browserSub) {
        try {
          await browserSub.unsubscribe();
        } catch {
          /* silencieux */
        }
      }
      setDeviceSub(null);
      setStatus(PUSH_STATUS.idle);
    } finally {
      setBusy(false);
    }
  }, [busy, deviceSub]);

  const sendTest = useCallback(async () => {
    setError(null);
    try {
      await pushService.sendTest();
      return true;
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Échec de l\'envoi du test');
      return false;
    }
  }, []);

  return (
    <PushContext.Provider
      value={{ status, config, deviceSub, error, busy, refresh, enable, disable, sendTest }}
    >
      {children}
    </PushContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePush = () => useContext(PushContext);