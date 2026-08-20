import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { notificationService } from '../api/notificationService';
import { notifySuccess, notifyInfo, notifyWarning } from '../utils/toast';

const NotificationContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const WS_URL = API_BASE.replace(/\/api\/?$/, '') || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const lastIdRef = useRef(null);
  const intervalRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
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

    const token = localStorage.getItem('token');
    if (token) {
      const socket = io(WS_URL, { query: { token } });
      socketRef.current = socket;

      socket.on('sortie_created', () => {
        notifyInfo('Nouvelle sortie créée');
      });

      socket.on('sortie_updated', (data) => {
        if (data?.deleted) {
          notifyInfo('Une sortie a été supprimée');
        } else {
          notifyInfo('Une sortie a été mise à jour');
        }
      });

      socket.on('connect_error', () => {
        // silent — polling fallback handles notifications
      });
    }

    const checkNotifications = async () => {
      try {
        const { data } = await notificationService.mine();
        const unread = data.filter((n) => !n.is_read);
        setUnreadCount(unread.length);

        if (lastIdRef.current === null) {
          lastIdRef.current = data.length > 0 ? Math.max(...data.map((n) => n.id)) : 0;
          return;
        }

        const newNotifs = data.filter(
          (n) => !n.is_read && n.id > lastIdRef.current
        );
        if (newNotifs.length > 0) {
          for (const n of newNotifs) {
            if (n.type === 'approved' || n.type === 'sortie_assignment') {
              notifySuccess(n.message);
            } else if (n.type === 'rejected' || n.type === 'cancelled') {
              notifyWarning(n.message);
            } else {
              notifyInfo(n.message);
            }
          }
          lastIdRef.current = Math.max(...newNotifs.map((n) => n.id));
        }
      } catch {
        // silent
      }
    };

    checkNotifications();
    intervalRef.current = setInterval(checkNotifications, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(NotificationContext);
