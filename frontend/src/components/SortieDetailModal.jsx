import { Modal, Group, Badge, Text, Stack, SimpleGrid, Divider, Paper, ScrollArea } from '@mantine/core';
import { IconUser, IconCar, IconCalendarClock, IconRoute, IconUsers } from '@tabler/icons-react';
import dayjs from '../utils/date';
import VehicleIcon from './VehicleIcon';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor, vehicleDisplayName } from '../utils/labels';

// Détail d'une sortie (partagé entre la vue Cartes et le DataTable).
export default function SortieDetailModal({ opened, onClose, sortie }) {
  if (!sortie) return null;

  const isMoto = sortie.Vehicle?.type === 'moto';
  const ds = sortie.displayStatus;
  const requests = sortie.Requests || [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Détail de la sortie"
      size="lg"
      radius="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      transitionProps={{ transition: 'pop', duration: 200 }}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Group justify="space-between" mb="md" wrap="wrap">
        <Text fw={600} size="lg">{sortie.destination}</Text>
        <Badge color={ds?.color || statusColor[sortie.status]} variant="light">
          {ds?.label || statusLabel[sortie.status]}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mb="sm">
        <Group gap={4}>
          <IconRoute size={15} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">Motif: </Text>
          <Text size="sm">{sortie.motif || '—'}</Text>
        </Group>
        <Group gap={4}>
          <IconCalendarClock size={15} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">Départ prévu: </Text>
          <Text size="sm">{dayjs(sortie.departure_time).format('DD/MM/YYYY HH:mm')}</Text>
        </Group>
        <Group gap={4}>
          <IconUser size={15} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">Chauffeur: </Text>
          <Text size="sm">{sortie.driver_name || 'Non affecté'}</Text>
        </Group>
        <Group gap={4}>
          <IconCar size={15} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">Véhicule: </Text>
          <VehicleIcon type={sortie.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{sortie.Vehicle ? vehicleDisplayName(sortie.Vehicle) : '—'}</Text>
          {sortie.Vehicle?.capacity != null && (
            <Text size="sm" c="dimmed">({sortie.Vehicle.capacity} pers.)</Text>
          )}
        </Group>
      </SimpleGrid>

      <Divider my="xs" />

      {!isMoto && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="sm">
          <Text size="xs" c="dimmed">Km départ</Text>
          <Text size="sm">{sortie.departure_km ?? '—'}</Text>
          <Text size="xs" c="dimmed">Km arrivée</Text>
          <Text size="sm">{sortie.arrival_km ?? '—'}</Text>
          <Text size="xs" c="dimmed">Km retour</Text>
          <Text size="sm">{sortie.return_km ?? '—'}</Text>
          <Text size="xs" c="dimmed">Distance</Text>
          <Text size="sm">{sortie.distance_km != null ? `${sortie.distance_km} km` : '—'}</Text>
        </SimpleGrid>
      )}

      {sortie.previous_departure_time && (
        <>
          <Divider my="xs" />
          <Text fw={600} size="sm" mb="xs">
            <Group gap={4}><IconCalendarClock size={15} color="var(--mantine-color-dimmed)" /> Replanification</Group>
          </Text>
          <Stack gap={4} mb="sm">
            <Group gap={4}>
              <Text size="sm" c="dimmed">Ancienne date: </Text>
              <Text size="sm">{dayjs(sortie.previous_departure_time).format('DD/MM/YYYY HH:mm')}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" c="dimmed">Nouvelle date: </Text>
              <Text size="sm">{dayjs(sortie.departure_time).format('DD/MM/YYYY HH:mm')}</Text>
            </Group>
            {sortie.reschedule_reason && (
              <Group gap={4}>
                <Text size="sm" c="dimmed">Motif: </Text>
                <Text size="sm">{sortie.reschedule_reason}</Text>
              </Group>
            )}
            <Group gap={4}>
              <Text size="sm" c="dimmed">Par: </Text>
              <Text size="sm">
                {sortie.rescheduler
                  ? `${sortie.rescheduler.prenom} ${sortie.rescheduler.nom}`
                  : sortie.rescheduled_by ? `Utilisateur #${sortie.rescheduled_by}` : '—'}
              </Text>
            </Group>
          </Stack>
        </>
      )}

      <Text fw={600} size="sm" mb="xs">
        <Group gap={4}><IconUsers size={15} color="var(--mantine-color-dimmed)" /> Passagers ({requests.length})</Group>
      </Text>
      {requests.length === 0 ? (
        <Text size="sm" c="dimmed">Aucune demande liée à cette sortie</Text>
      ) : (
        <Stack gap="xs">
          {requests.map((r) => {
            const sr = r.SortieRequest;
            const name = r.Employee ? `${r.Employee.prenom} ${r.Employee.nom}`.trim() : `Employé #${r.employee_id}`;
            return (
              <Paper key={r.id} withBorder radius="md" p="sm">
                <Group justify="space-between" wrap="wrap">
                  <Text size="sm" fw={500}>{name}</Text>
                  <Badge size="xs" variant="light" color={
                    sr?.status === 'finished' ? 'brand' : sr?.status === 'ongoing' ? 'brandYellow' : 'gray'
                  }>
                    {sr?.status === 'finished' ? `Terminé${isMoto && sr?.return_km != null ? ` (${sr.departure_km} → ${sr.return_km} km)` : ''}`
                      : sr?.status === 'ongoing' ? 'En cours' : 'À venir'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  N°{r.id} · {r.destination}{r.motif ? ` · ${r.motif}` : ''} · {r.nb_personnes ?? 1} pers.
                </Text>
                {isMoto && sr?.departure_km != null && sr?.return_km != null && (
                  <Text size="xs" c="dimmed">Kilomètres: {sr.departure_km} → {sr.return_km} ({sr.distance_km} km)</Text>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Modal>
  );
}