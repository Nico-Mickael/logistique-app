import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { notificationService } from '../api/notificationService';
import api from '../api/axios';
import { notifySuccess, notifyInfo, notifyWarning } from '../utils/toast';

const NotificationContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const WS_URL = API_BASE.startsWith('http')
  ? (API_BASE.replace(/\/api\/?$/, '') || window.location.origin)
  : window.location.origin;

const POLL_INTERVAL = 5000;

const toastForType = (type, message) => {
  if (type === 'approved' || type === 'sortie_assignment') {
    notifySuccess(message);
  } else if (type === 'rejected' || type === 'cancelled' || type === 'vehicle_alert') {
    notifyWarning(message);
  } else {
    notifyInfo(message);
  }
};

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [badgeCounts, setBadgeCounts] = useState({ requests: 0, sorties: 0 });
  const lastIdRef = useRef(null);
  const intervalRef = useRef(null);
  const socketRef = useRef(null);

  const isUserOnline = useCallback(
    (id) => onlineUserIds.has(Number(id)),
    [onlineUserIds],
  );

  // Compteurs sidebar ("Demandes" / "Sorties") : demandes en attente de
  // validation + sorties planifiées. Rafraîchis par le polling et par les
  // événements socket (création/validation/refus de demande, création/maj de
  // sortie) → mise à jour automatique sans recharger la page.
  const refreshBadges = useCallback(async () => {
    const role = user?.role;
    if (role !== 'logistics_chief' && role !== 'admin' && role !== 'superadmin') return;
    try {
      const { data } = await api.get('/stats/badges');
      setBadgeCounts({
        requests: typeof data?.requests === 'number' ? data.requests : 0,
        sorties: typeof data?.sorties === 'number' ? data.sorties : 0,
      });
    } catch {
      // silent
    }
  }, [user]);

  const checkNotifications = useCallback(async () => {
    try {
      const [{ data: unread }, { data: notifPage }] = await Promise.all([
        notificationService.unreadCount(),
        notificationService.mine({ limit: 50 }),
      ]);
      const unreadNum = typeof unread?.count === 'number' ? unread.count : 0;
      setUnreadCount(unreadNum);

      const list = Array.isArray(notifPage) ? notifPage : notifPage?.data || [];
      if (lastIdRef.current === null) {
        lastIdRef.current = list.length > 0 ? Math.max(...list.map((n) => n.id)) : 0;
        return;
      }

      const newNotifs = list.filter(
        (n) => !n.is_read && n.id > lastIdRef.current
      );
      if (newNotifs.length > 0) {
        for (const n of newNotifs) {
          toastForType(n.type, n.message);
        }
        lastIdRef.current = Math.max(...newNotifs.map((n) => n.id));
      }
    } catch {
      // silent
    }
  }, []);

  const refreshUnreadCount = useCallback(() => {
    checkNotifications();
  }, [checkNotifications]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setOnlineUserIds(new Set());
      setBadgeCounts({ requests: 0, sorties: 0 });
      lastIdRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (token) {
      const socket = io(WS_URL, { query: { token } });
      socketRef.current = socket;

      socket.on('sortie_created', () => {
        notifyInfo('Nouvelle sortie créée');
        refreshBadges();
      });

      socket.on('sortie_updated', (data) => {
        if (data?.deleted) {
          notifyInfo('Une sortie a été supprimée');
        } else {
          notifyInfo('Une sortie a été mise à jour');
        }
        refreshBadges();
      });

      socket.on('connect', () => {
        refreshBadges();
      });

      socket.on('connect_error', () => {
        // silent — polling fallback handles notifications
      });

      // Réception instantanée (le polling reste en filet de sécurité)
      socket.on('notification', (notif) => {
        if (!notif?.id) return;
        if (lastIdRef.current === null || notif.id > lastIdRef.current) {
          lastIdRef.current = notif.id;
          setUnreadCount((c) => c + 1);
        }
        toastForType(notif.type, notif.message);
        refreshBadges();
      });

      socket.on('presence', (data) => {
        if (!data || data.user_id == null) return;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(data.user_id);
          else next.delete(data.user_id);
          return next;
        });
      });
    }

    checkNotifications();
    refreshBadges();
    intervalRef.current = setInterval(() => {
      checkNotifications();
      refreshBadges();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, checkNotifications, refreshBadges]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, onlineUserIds, isUserOnline, badgeCounts }}>
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(NotificationContext);