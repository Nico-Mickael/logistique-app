import { useState, useEffect, useCallback } from 'react';
import {
  Title, Text, Paper, Stack, Group, Badge, ActionIcon, Button, Divider,
  Tooltip, Loader, Center, Alert, Pagination,
} from '@mantine/core';
import {
  IconDeviceDesktop, IconDeviceMobile, IconDeviceTablet,
  IconLogout, IconTrash, IconRefresh, IconAlertCircle,
} from '@tabler/icons-react';
import { authService } from '../api/authService';
import { notifySuccess, notifyError } from '../utils/toast';

const deviceIcon = (device) => {
  if (/mobile/i.test(device)) return IconDeviceMobile;
  if (/tablette/i.test(device)) return IconDeviceTablet;
  return IconDeviceDesktop;
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revokedPage, setRevokedPage] = useState(1);
  const revokedPerPage = 5;

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await authService.sessions();
      setSessions(data);
      setRevokedPage(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRevoke = async (id) => {
    try {
      await authService.revokeSession(id);
      notifySuccess('Session révoquée');
      fetchSessions();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la révocation');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await authService.logoutAll();
      notifySuccess('Toutes les autres sessions ont été révoquées');
      fetchSessions();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const activeSessions = sessions.filter((s) => s.active);
  const revokedSessions = sessions.filter((s) => !s.active);
  const revokedTotalPages = Math.max(1, Math.ceil(revokedSessions.length / revokedPerPage));
  const revokedPageSessions = revokedSessions.slice(
    (revokedPage - 1) * revokedPerPage,
    revokedPage * revokedPerPage
  );

  return (
    <Stack gap="md" maw={700} mx="auto">
      <Group justify="space-between">
        <div>
          <Title order={4}>Sessions actives</Title>
          <Text size="sm" c="dimmed">
            Gérez les appareils connectés à votre compte
          </Text>
        </div>
        <Group gap="xs">
          <Tooltip label="Rafraîchir">
            <ActionIcon variant="light" color="gray" onClick={fetchSessions}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          {activeSessions.length > 1 && (
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconLogout size={14} />}
              onClick={handleLogoutAll}
            >
              Tout révoquer
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      <Stack gap="xs">
        {activeSessions.map((s) => {
          const Icon = deviceIcon(s.device);
          return (
            <Paper key={s.id} p="sm" withBorder radius="md">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <Icon size={24} color="var(--mantine-color-dimmed)" />
                  <div>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600}>{s.device || 'Appareil inconnu'}</Text>
                      {s.current && (
                        <Badge size="xs" color="green" variant="light">Actuelle</Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {s.ip || 'IP inconnue'} · Connecté {timeAgo(s.createdAt)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Dernière activité {timeAgo(s.lastActive)}
                    </Text>
                  </div>
                </Group>
                {!s.current && (
                  <Tooltip label="Révoquer cette session">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleRevoke(s.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Paper>
          );
        })}
      </Stack>

      {revokedSessions.length > 0 && (
        <>
          <Divider label="Sessions terminées" labelPosition="center" />
          <Stack gap="xs">
            {revokedPageSessions.map((s) => {
              const Icon = deviceIcon(s.device);
              return (
                <Paper key={s.id} p="sm" withBorder radius="md" opacity={0.5}>
                  <Group gap="sm" wrap="nowrap">
                    <Icon size={20} color="var(--mantine-color-dimmed)" />
                    <div>
                      <Text size="sm">{s.device || 'Appareil inconnu'}</Text>
                      <Text size="xs" c="dimmed">
                        {s.ip || 'IP inconnue'} · Session terminée
                      </Text>
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
          {revokedTotalPages > 1 && (
            <Center>
              <Pagination
                value={revokedPage}
                onChange={setRevokedPage}
                total={revokedTotalPages}
                color="brand"
                size="sm"
              />
            </Center>
          )}
        </>
      )}
    </Stack>
  );
}
