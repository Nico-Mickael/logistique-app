import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../api/notificationService';
import { notifySuccess, notifyInfo, notifyWarning } from '../utils/toast';

const NotificationContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const lastIdRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkNotifications = async () => {
      try {
        const { data } = await notificationService.mine();
        const unread = data.filter((n) => !n.is_read);
        setUnreadCount(unread.length);

        const newNotifs = data.filter(
          (n) => n.is_read === false && lastIdRef.current !== null && n.id > lastIdRef.current
        );
        if (newNotifs.length > 0) {
          for (const n of newNotifs) {
            const type = n.type;
            if (type === 'approved') {
              notifySuccess(n.message);
            } else if (type === 'rejected' || type === 'cancelled') {
              notifyWarning(n.message);
            } else {
              notifyInfo(n.message);
            }
          }
        }
        if (data.length > 0) {
          lastIdRef.current = Math.max(...data.map((n) => n.id));
        }
      } catch {
        // silent
      }
    };

    checkNotifications();
    intervalRef.current = setInterval(checkNotifications, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useSocket = () => useContext(NotificationContext);
