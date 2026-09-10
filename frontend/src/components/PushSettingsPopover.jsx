import { useState } from 'react';
import {
  ActionIcon, Popover, Stack, Text, Loader, Button, Tooltip,
  Divider, Group, Badge, Alert,
} from '@mantine/core';
import {
  IconBellRinging, IconDeviceMobileMessage, IconX, IconCheck, IconSend,
} from '@tabler/icons-react';
import { usePush, PUSH_STATUS } from '../context/PushContext';
import { formatEndpoint } from '../utils/push';
import { notifySuccess, notifyWarning } from '../utils/toast';

export default function PushSettingsPopover() {
  const { status, deviceSub, error, busy, enable, disable, sendTest } = usePush();
  const [opened, setOpened] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleEnable = async () => {
    await enable();
    if (status !== PUSH_STATUS.subscribed) return;
    notifySuccess('Notifications push activées sur ce téléphone');
  };

  const handleDisable = async () => {
    await disable();
    notifyWarning('Notifications push désactivées sur ce téléphone');
  };

  const handleTest = async () => {
    setTesting(true);
    const ok = await sendTest();
    setTesting(false);
    if (ok) notifySuccess('Notification de test envoyée');
  };

  const renderStatus = () => {
    switch (status) {
      case PUSH_STATUS.loading:
        return <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Vérification…</Text></Group>;
      case PUSH_STATUS.unsupported:
        return (
          <Alert color="gray" radius="md" icon={<IconX size={16} />}>
            <Text size="sm">Notifications push non supportées par ce navigateur ou contexte non sécurisé (HTTPS requis).</Text>
          </Alert>
        );
      case PUSH_STATUS.disabled:
        return (
          <Alert color="gray" radius="md" icon={<IconX size={16} />}>
            <Text size="sm">Notifications push non configurées par l'administrateur.</Text>
          </Alert>
        );
      case PUSH_STATUS.denied:
        return (
          <Alert color="orange" radius="md" icon={<IconX size={16} />}>
            <Text size="sm">Permission refusée. Activez les notifications dans les réglages du navigateur, puis réessayez.</Text>
            <Button size="xs" variant="light" mt="xs" onClick={() => enable()} loading={busy}>
              Réessayer
            </Button>
          </Alert>
        );
      case PUSH_STATUS.subscribed:
        return (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Activé</Badge>
              {deviceSub?.device && <Text size="xs" c="dimmed">{deviceSub.device}</Text>}
            </Group>
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed">
                {deviceSub?.endpoint ? formatEndpoint(deviceSub.endpoint) : 'Ce téléphone reçoit les alertes'}
              </Text>
            </Group>
            <Button size="xs" variant="light" color="brand" onClick={handleTest} loading={testing} leftSection={<IconSend size={14} />}>
              Envoyer un test
            </Button>
            <Button size="xs" variant="light" color="red" onClick={handleDisable} loading={busy}>
              Désactiver sur ce téléphone
            </Button>
          </Stack>
        );
      case PUSH_STATUS.error:
        return (
          <Alert color="red" radius="md" icon={<IconX size={16} />}>
            <Text size="sm">{error || 'Erreur inconnue'}</Text>
          </Alert>
        );
      default: // idle
        return (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Recevez les alertes importantes (nouvelles sorties, rappels, annulations…) même lorsque l'application est fermée.
            </Text>
            <Button
              size="xs"
              leftSection={<IconBellRinging size={15} />}
              onClick={handleEnable}
              loading={busy}
              color="brand"
            >
              Activer les alertes sur ce téléphone
            </Button>
          </Stack>
        );
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} width={{ base: 'calc(100vw - 32px)', sm: 340 }} position="bottom-end" shadow="lg" radius="md">
      <Popover.Target>
        <Tooltip label="Notifications téléphone" position="bottom" withArrow>
          <ActionIcon variant="subtle" color="white" aria-label="Notifications téléphone" onClick={() => setOpened((o) => !o)}>
            <IconDeviceMobileMessage size={19} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="sm">Notifications téléphone</Text>
        </Group>
        <Divider mb="sm" />
        {renderStatus()}
      </Popover.Dropdown>
    </Popover>
  );
}