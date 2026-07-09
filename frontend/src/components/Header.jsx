import { useEffect, useState, useRef } from 'react';
import {
  Group, Text, ActionIcon, Popover, Stack, UnstyledButton, Badge,
  Loader, Center, ScrollArea, Burger, Avatar, Tooltip, Divider,
} from '@mantine/core';
import { IconBell, IconLogout } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../api/notificationService';
import Logo from './Logo';

function initials(user) {
  if (!user) return '';
  return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase();
}

function Header({ opened: navOpened, onToggle }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [notifOpened, setNotifOpened] = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationService.mine();
      setNotifications(data);
    } catch {
      // silent
    } finally {
      setLoadingNotif(false);
    }
  };

  useEffect(() => {
    if (user) {
      setLoadingNotif(true);
      fetchNotifications();
      intervalRef.current = setInterval(fetchNotifications, 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // silent
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" className="app-header">
      <Group gap="sm" wrap="nowrap">
        <Burger opened={navOpened} onClick={onToggle} hiddenFrom="sm" size="sm" color="white" />
        <div className="logo-badge">
          <Logo height={22} />
        </div>
      </Group>

      <Group gap="md" wrap="nowrap">
        <Group gap={8} wrap="nowrap" className="hide-on-mobile">
          <Avatar size={30} radius="xl" color="brandYellow" variant="filled">
            {initials(user)}
          </Avatar>
          <div>
            <Text size="sm" c="white" fw={500} lh={1.1}>
              {user?.prenom} {user?.nom}
            </Text>
          </div>
        </Group>

        <Divider orientation="vertical" color="rgba(255,255,255,0.25)" className="hide-on-mobile" />

        <Popover opened={notifOpened} onChange={setNotifOpened} width={360} position="bottom-end" shadow="lg" radius="md">
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="white"
              className={unreadCount > 0 ? 'bell-active' : ''}
              onClick={() => setNotifOpened((o) => !o)}
              aria-label="Notifications"
            >
              <div style={{ position: 'relative' }}>
                <IconBell size={19} />
                {unreadCount > 0 && (
                  <Badge size="xs" color="red" variant="filled" className="notif-badge">
                    {unreadCount}
                  </Badge>
                )}
              </div>
            </ActionIcon>
          </Popover.Target>

          <Popover.Dropdown p="xs">
            <Group justify="space-between" px="xs" mb="xs">
              <Text size="sm" fw={600}>Notifications</Text>
              {unreadCount > 0 && (
                <Badge size="xs" variant="light" color="red">{unreadCount} non lues</Badge>
              )}
            </Group>
            {loadingNotif && notifications.length === 0 ? (
              <Center h={60}><Loader size="sm" /></Center>
            ) : notifications.length === 0 ? (
              <Center h={80}>
                <Text size="sm" c="dimmed">Aucune notification</Text>
              </Center>
            ) : (
              <ScrollArea.Autosize mah={320}>
                <Stack gap={2}>
                  {notifications.map((n) => (
                    <UnstyledButton
                      key={n.id}
                      p="sm"
                      className="notif-item"
                      data-unread={!n.is_read}
                      onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                    >
                      <Text size="sm" fw={n.is_read ? 400 : 500}>{n.message}</Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {new Date(n.createdAt).toLocaleString('fr-FR')}
                      </Text>
                    </UnstyledButton>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Popover.Dropdown>
        </Popover>

        <Tooltip label="Se déconnecter" position="bottom" withArrow>
          <ActionIcon variant="subtle" color="white" onClick={handleLogout} aria-label="Se déconnecter">
            <IconLogout size={19} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <style>{`
        .app-header {
          background: linear-gradient(135deg, #ffffff 0%, #ffffff 60%, #164d18 50%);
        }

        .logo-badge {
          background: #fff;
          border-radius: 8px;
          padding: 4px 10px;
          display: inline-flex;
          align-items: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }

        .notif-badge {
          position: absolute;
          top: -6px;
          right: -8px;
          min-width: 16px;
          height: 16px;
          padding: 0;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bell-active {
          animation: bell-ring 2.5s ease-in-out infinite;
        }

        @keyframes bell-ring {
          0%, 100% { transform: rotate(0); }
          92% { transform: rotate(0); }
          94% { transform: rotate(-12deg); }
          96% { transform: rotate(10deg); }
          98% { transform: rotate(-6deg); }
        }

        .notif-item {
          border-radius: 8px;
          background-color: transparent;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .notif-item[data-unread="true"] {
          background-color: var(--mantine-color-brand-0);
        }

        .notif-item:hover {
          background-color: var(--mantine-color-gray-1);
        }

        .notif-item[data-unread="true"]:hover {
          background-color: var(--mantine-color-brand-1);
        }

        @media (prefers-reduced-motion: reduce) {
          .bell-active { animation: none; }
        }
      `}</style>
    </Group>
  );
}

export default Header;