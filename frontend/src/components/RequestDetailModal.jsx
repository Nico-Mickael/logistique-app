import { Modal, Group, Badge, Text, Stack, Divider, ScrollArea } from '@mantine/core';
import dayjs from '../utils/date';
import { requestStatusLabel, requestStatusColor, vehicleDisplayName } from '../utils/labels';

function InfoRow({ label, value }) {
  return (
    <Group gap="xs" align={typeof value === 'string' ? 'center' : 'flex-start'} wrap="nowrap" style={{ minWidth: 0 }}>
      <Text size="sm" c="dimmed" w={110} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</Text>
      <Text size="sm" fw={600} style={{ minWidth: 0 }}>{value || '—'}</Text>
    </Group>
  );
}

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
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Text fw={600} size="md" truncate style={{ minWidth: 0 }}>{r.destination}</Text>
        <Badge color={requestStatusColor[r.status] || 'gray'} variant="light">
          {requestStatusLabel[r.status] || r.status}
        </Badge>
      </Group>
      {showEmployee && (
        <Text size="sm" c="dimmed" mb="xs">
          {r.Employee?.prenom} {r.Employee?.nom}{r.Employee?.department ? ` — ${r.Employee.department}` : ''}
        </Text>
      )}
      <Divider mb="sm" />
      <Stack gap={6}>
        {r.motif && <InfoRow label="Motif" value={r.motif} />}
        <InfoRow label="Date" value={dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')} />
        <InfoRow label="Passagers" value={`${r.nb_personnes} personne(s)`} />
        <InfoRow
          label="Véhicule"
          value={r.Vehicle ? `${vehicleDisplayName(r.Vehicle)} (${r.Vehicle.capacity} pers.)` : 'Non assigné'}
        />
        {r.status === 'rescheduled' && r.reschedule_reason && (
          <InfoRow label="Replanification" value={r.reschedule_reason} />
        )}
        {r.Sorties?.[0]?.destination && (
          <InfoRow label="Sortie" value={`${r.Sorties[0].destination}${r.Sorties[0].motif ? ` — ${r.Sorties[0].motif}` : ''}`} />
        )}
      </Stack>
    </Modal>
  );
}