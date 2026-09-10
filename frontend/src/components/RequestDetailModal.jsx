import { Modal, Group, Badge, Text, Stack, Divider, ScrollArea } from '@mantine/core';
import { IconMapPin, IconNote, IconCalendarEvent, IconUsers, IconCar, IconUser, IconRoute } from '@tabler/icons-react';
import dayjs from '../utils/date';
import { requestStatusLabel, requestStatusColor, vehicleDisplayName } from '../utils/labels';

// Détail d'une demande — modal propre, centrée, scrollable, partagée entre
// la page chef (Demandes à valider) et la page employé (Mes demandes).
export default function RequestDetailModal({ opened, onClose, request: r, showEmployee = true }) {
  if (!r) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Détail de la demande"
      size="md"
      radius="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      transitionProps={{ transition: 'pop', duration: 200 }}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6} style={{ minWidth: 0 }}>
            <IconMapPin size={18} color="var(--mantine-color-brand-6)" />
            <Text fw={600} truncate>{r.destination}</Text>
          </Group>
          <Badge color={requestStatusColor[r.status] || 'gray'} variant="light">
            {requestStatusLabel[r.status] || r.status}
          </Badge>
        </Group>

        {showEmployee && (
          <>
            <Group gap={6}>
              <IconUser size={16} color="var(--mantine-color-dimmed)" />
              <Text size="sm" fw={500}>
                {r.Employee?.prenom} {r.Employee?.nom}
              </Text>
            </Group>
            {r.Employee?.department && (
              <Text size="sm" c="dimmed">{r.Employee.department}</Text>
            )}
          </>
        )}

        <Divider my={4} />

        {r.motif && (
          <Group gap={6} align="flex-start">
            <IconNote size={16} color="var(--mantine-color-dimmed)" style={{ marginTop: 2 }} />
            <Text size="sm">{r.motif}</Text>
          </Group>
        )}
        <Group gap={6}>
          <IconCalendarEvent size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Text>
        </Group>
        <Group gap={6}>
          <IconUsers size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{r.nb_personnes} personne(s)</Text>
        </Group>
        <Group gap={6}>
          <IconCar size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm">
            {r.Vehicle ? `${vehicleDisplayName(r.Vehicle)} (${r.Vehicle.capacity} pers.)` : 'Non assigné'}
          </Text>
        </Group>
        {r.Sorties?.[0]?.destination && (
          <Group gap={6}>
            <IconRoute size={16} color="var(--mantine-color-dimmed)" />
            <Text size="sm">
              Sortie vers {r.Sorties[0].destination}
              {r.Sorties[0].motif ? ` — ${r.Sorties[0].motif}` : ''}
            </Text>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}