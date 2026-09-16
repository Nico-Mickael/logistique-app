import { useEffect, useMemo, useState } from 'react';
import {
  Group, Text, ActionIcon, Popover, Stack, UnstyledButton, Badge,
  Button, Loader, Center, ScrollArea, Burger, Avatar, Tooltip, Divider,
  Select, Menu, useMantineColorScheme,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconBell, IconLogout, IconX, IconBuilding, IconCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { notificationService } from '../api/notificationService';
import { siteService } from '../api/siteService';
import { notifyError } from '../utils/toast';
import { getSiteOverride, setSiteOverride } from '../api/axios';
import { availabilityStatusLabel, availabilityStatusDot } from '../utils/labels';
import Logo from './Logo';

function toDateStr(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initials(user) {
  if (!user) return '';
  return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase();
}

function Header({ opened: navOpened, onToggle }) {
  const { logout, user, updateAvailability } = useAuth();
  const { unreadCount, refreshUnreadCount } = useSocket();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const navigate = useNavigate();
  const isSuperadmin = user?.role === 'superadmin';
  const availability = user?.availability_status || 'available';
  const availabilityLabel = availabilityStatusLabel[availability] || availability;
  const availabilityDot = availabilityStatusDot[availability] || '#9098a3';
  const [sites, setSites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [notifOpened, setNotifOpened] = useState(false);
  const [availMenuOpened, setAvailMenuOpened] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [leaveStart, setLeaveStart] = useState(null);
  const [leaveEnd, setLeaveEnd] = useState(null);

  // Synchronise les dates de congé affichées avec l'état de l'utilisateur.
  useEffect(() => {
    const parseDay = (s) => (s ? new Date(`${s}T00:00:00`) : null);
    setLeaveStart(parseDay(user?.leave_start_date));
    setLeaveEnd(parseDay(user?.leave_end_date));
  }, [user?.leave_start_date, user?.leave_end_date]);

  const setStatus = async (status) => {
    setUpdatingAvailability(true);
    try {
      await updateAvailability({ availability_status: status });
      setAvailMenuOpened(false);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const applyLeave = async () => {
    if (!leaveStart || !leaveEnd) {
      notifyError('Choisissez une date de début et de fin de congé');
      return;
    }
    if (toDateStr(leaveEnd) < toDateStr(leaveStart)) {
      notifyError('La fin de congé doit être le jour même ou après le début');
      return;
    }
    setUpdatingAvailability(true);
    try {
      await updateAvailability({
        availability_status: 'on_leave',
        leave_start_date: toDateStr(leaveStart),
        leave_end_date: toDateStr(leaveEnd),
      });
      setAvailMenuOpened(false);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const currentSiteName = useMemo(() => {
    if (isSuperadmin) {
      const override = getSiteOverride();
      if (override == null) return 'Tous les sites';
      return sites.find((s) => s.id === override)?.name || null;
    }
    return sites.find((s) => s.id === user?.site_id)?.name || null;
  }, [sites, isSuperadmin, user?.site_id]);

  useEffect(() => {
    siteService
      .list()
      .then(({ data }) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]));
  }, []);

  const handleSiteChange = (value) => {
    setSiteOverride(value && value !== '' ? Number(value) : null);
    window.location.reload();
  };

  const siteOptions = useMemo(
    () => [
      { value: '', label: 'Tous les sites' },
      ...sites.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [sites]
  );

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationService.mine({ limit: 50 });
      setNotifications(Array.isArray(data) ? data : data?.data || []);
    } catch {
      // silent
    } finally {
      setLoadingNotif(false);
    }
  };

  useEffect(() => {
    if (notifOpened && user) {
      setLoadingNotif(true);
      fetchNotifications();
    }
  }, [notifOpened, user, unreadCount]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      refreshUnreadCount();
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      refreshUnreadCount();
    } catch {
      // silent
    }
  };

  const handleDeleteNotif = async (id) => {
    try {
      await notificationService.remove(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnreadCount();
    } catch {
      // silent
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Group h="100%" px={{ base: 'xs', sm: 'md' }} justify="space-between" wrap="nowrap" className="app-header">
      <Group gap="sm" wrap="nowrap">
        <Burger opened={navOpened} onClick={onToggle} hiddenFrom="md" size="sm" color={dark ? '#fff' : '#1a1a1a'} />
        {isSuperadmin ? (
          <div className="hide-on-mobile">
            <Select
              size="xs"
              radius="xl"
              w={150}
              data={siteOptions}
              value={getSiteOverride() == null ? '' : String(getSiteOverride())}
              onChange={handleSiteChange}
              aria-label="Filtrer par site"
              styles={{
                input: {
                  background: 'var(--mantine-color-brand-6)',
                  color: '#fff',
                  borderColor: 'var(--mantine-color-brand-7)',
                  fontWeight: 600,
                  paddingLeft: 10,
                  paddingRight: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                },
                dropdown: { color: 'var(--mantine-color-text)' },
              }}
            />
          </div>
        ) : (
          <div className="hide-on-mobile">
            {currentSiteName && (
              <Badge variant="light" color="brand" size="lg" leftSection={<IconBuilding size={13} />} style={{ textTransform: 'none' }}>
                {currentSiteName}
              </Badge>
            )}
          </div>
        )}
        <Group gap={8} wrap="nowrap" className="app-brand-mobile" hiddenFrom="md" pl={2}>
          <Logo height={24} />
          <Text size="sm" fw={600} c={dark ? '#fff' : '#1a1a1a'} lh={1.1} className="app-brand-label">
            Gestion logistique
          </Text>
        </Group>
      </Group>

      <Group gap={{ base: 6, sm: 'md' }} wrap="nowrap">
        <Menu opened={availMenuOpened} onChange={setAvailMenuOpened} closeOnItemClick={false} position="bottom-end" withArrow shadow="lg" width={270} radius="md">
          <Menu.Target>
            <Group gap={8} wrap="nowrap" className="hide-on-mobile" style={{ cursor: 'pointer', borderRadius: 8, padding: '2px 6px' }}>
              <div style={{ position: 'relative' }}>
                <Avatar size={30} radius="xl" color="brandYellow" variant="filled">
                  {initials(user)}
                </Avatar>
                <Tooltip label={availabilityLabel} position="bottom" withArrow>
                  <span
                    aria-label={availabilityLabel}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: availabilityDot,
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                    }}
                  />
                </Tooltip>
              </div>
              <div>
                <Text size="sm" c="white" fw={500} lh={1.1}>
                  {user?.prenom} {user?.nom}
                </Text>
                <Text size="xs" c={availability === 'available' ? '#a5d6a7' : 'rgba(255,255,255,0.6)'} fw={500} lh={1.1}>
                  {availabilityLabel}
                </Text>
              </div>
            </Group>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Ma disponibilité</Menu.Label>
            {['available', 'offline', 'absent'].map((s) => (
              <Menu.Item
                key={s}
                leftSection={<span style={{ width: 10, height: 10, borderRadius: '50%', background: availabilityStatusDot[s] }} />}
                rightSection={availability === s ? <IconCheck size={14} color="var(--mantine-color-brand-6)" /> : undefined}
                onClick={() => setStatus(s)}
                disabled={updatingAvailability}
              >
                {availabilityStatusLabel[s]}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Label>Congé planifié</Menu.Label>
            <div style={{ padding: '4px 12px 10px' }}>
              <DateInput
                label="Début"
                placeholder="JJ/MM/AAAA"
                value={leaveStart}
                onChange={setLeaveStart}
                minDate={new Date()}
                radius="md"
                w="100%"
              />
              <DateInput
                label="Fin"
                placeholder="JJ/MM/AAAA"
                value={leaveEnd}
                onChange={setLeaveEnd}
                minDate={leaveStart || new Date()}
                radius="md"
                w="100%"
                mt="xs"
              />
              <Button
                size="compact-sm"
                color="brand"
                fullWidth
                mt="xs"
                loading={updatingAvailability}
                disabled={!leaveStart || !leaveEnd}
                onClick={applyLeave}
              >
                {availability === 'on_leave' ? 'Modifier le congé' : 'Partir en congé'}
              </Button>
              {availability === 'on_leave' && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  fullWidth
                  mt={4}
                  disabled={updatingAvailability}
                  onClick={() => setStatus('available')}
                >
                  Rendre disponible maintenant
                </Button>
              )}
            </div>
          </Menu.Dropdown>
        </Menu>

        <Divider orientation="vertical" color="rgba(255,255,255,0.25)" className="hide-on-mobile" />

        <Popover opened={notifOpened} onChange={setNotifOpened} width={{ base: 'calc(100vw - 32px)', sm: 360 }} position="bottom-end" shadow="lg" radius="md">
          <Popover.Target>
            <div style={{ position: 'relative' }}>
              <ActionIcon
                variant="subtle"
                color="white"
                className={unreadCount > 0 ? 'bell-active' : ''}
                onClick={() => setNotifOpened((o) => !o)}
                aria-label="Notifications"
              >
                <IconBell size={19} />
              </ActionIcon>
              {unreadCount > 0 && (
                <div className="notif-badge">{unreadCount}</div>
              )}
            </div>
          </Popover.Target>

          <Popover.Dropdown p="xs">
            <Group justify="space-between" px="xs" mb="xs">
              <Text size="sm" fw={600}>Notifications</Text>
              <Group gap="xs">
                {unreadCount > 0 && (
                  <Button size="compact-xs" variant="subtle" color="brand" onClick={handleMarkAllRead}>
                    Tout marquer lu
                  </Button>
                )}
                {unreadCount > 0 && (
                  <Badge size="xs" variant="light" color="red">{unreadCount} non lues</Badge>
                )}
              </Group>
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
                    <div key={n.id} style={{ position: 'relative' }}>
                      <UnstyledButton
                        w="100%"
                        p="sm"
                        pr={34}
                        className="notif-item"
                        data-unread={!n.is_read}
                        onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                      >
                        <Text size="sm" fw={n.is_read ? 400 : 500}>{n.message}</Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          {new Date(n.createdAt).toLocaleString('fr-FR')}
                        </Text>
                      </UnstyledButton>
                      <ActionIcon
                        size="sm"
                        variant="transparent"
                        color="dimmed"
                        aria-label="Supprimer la notification"
                        style={{ position: 'absolute', top: 6, right: 4 }}
                        onClick={() => handleDeleteNotif(n.id)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </div>
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
          background: ${dark
    ? 'linear-gradient(135deg, #1A1B1E 0%, #1A1B1E 50%, #164d18 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #ffffff 50%, #164d18 100%)'};
        }

        .app-brand-label {
          max-width: 38vw;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notif-badge {
          position: absolute;
          top: -7px;
          right: -9px;
          z-index: 5;
          pointer-events: none;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          background: var(--mantine-color-red-filled);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          padding: 0 4px;
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
          background-color: light-dark(var(--mantine-color-brand-0), rgba(63, 163, 74, 0.18));
        }

        .notif-item:hover {
          background-color: light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-4));
        }

        .notif-item[data-unread="true"]:hover {
          background-color: light-dark(var(--mantine-color-brand-1), rgba(63, 163, 74, 0.28));
        }

        @media (prefers-reduced-motion: reduce) {
          .bell-active { animation: none; }
        }
      `}</style>
    </Group>
  );
}

export default Header;