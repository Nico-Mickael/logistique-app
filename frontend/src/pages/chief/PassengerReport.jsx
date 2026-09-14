import { useEffect, useState } from 'react';
import {
  Paper, Text, Group, Badge, Stack, SimpleGrid, Divider, Table,
  Button, Select, ThemeIcon, Menu,
} from '@mantine/core';
import { DateInput, TimeInput } from '@mantine/dates';
import {
  IconFileText, IconUsers, IconSearch, IconX, IconDownload,
} from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { statsService } from '../../api/statsService';
import { vehicleService } from '../../api/vehicleService';
import { exportService } from '../../api/exportService';
import { notifyError } from '../../utils/toast';
import { downloadCSV } from '../../utils/csv';
import { sortieStatusLabel, sortieStatusColor, VEHICLE_TYPE_OPTIONS, vehicleDisplayName } from '../../utils/labels';
import PageHeader from '../../components/PageHeader';
import ReportBreadcrumb from '../../components/ReportBreadcrumb';

export default function PassengerReport() {
  const [vehicles, setVehicles] = useState([]);
  const [passengerDate, setPassengerDate] = useState(null);
  const [passengerVehicle, setPassengerVehicle] = useState('');
  const [passengerType, setPassengerType] = useState('');
  const [passengerTimeFrom, setPassengerTimeFrom] = useState('');
  const [passengerTimeTo, setPassengerTimeTo] = useState('');
  const [passengerRows, setPassengerRows] = useState([]);
  const [passengerLoading, setPassengerLoading] = useState(false);

  useEffect(() => {
    vehicleService.getAll()
      .then(({ data }) => setVehicles(data || []))
      .catch(() => {});
  }, []);

  const handleExport = (fn) => {
    fn().catch(() => notifyError("Échec de l'export"));
  };

  const fetchPassengerReport = () => {
    if (!passengerDate) {
      notifyError('Veuillez sélectionner une date');
      return;
    }
    setPassengerLoading(true);
    const params = { date: dayjs(passengerDate).format('YYYY-MM-DD') };
    if (passengerVehicle) params.vehicle_id = passengerVehicle;
    if (passengerType) params.vehicle_type = passengerType;
    if (passengerTimeFrom) params.time_from = passengerTimeFrom;
    if (passengerTimeTo) params.time_to = passengerTimeTo;
    statsService.sortiesPassengers(params)
      .then(({ data }) => setPassengerRows(data || []))
      .catch(() => notifyError('Impossible de charger le rapport'))
      .finally(() => setPassengerLoading(false));
  };

  const exportPassengerCSV = () => {
    if (!passengerRows.length) return;
    const rows = [];
    for (const s of passengerRows) {
      const base = [
        dayjs(s.departure_time).format('DD/MM/YYYY'),
        s.id,
        s.vehicle ? vehicleDisplayName(s.vehicle) : '',
        s.vehicle?.capacity ?? '',
        s.driver_name,
        s.destination,
        dayjs(s.departure_time).format('HH:mm'),
        s.departed_at ? dayjs(s.departed_at).format('HH:mm') : '',
        s.returned_at ? dayjs(s.returned_at).format('HH:mm') : '',
        sortieStatusLabel[s.status] || s.status,
        s.departure_km ?? '',
        s.arrival_km ?? '',
        s.distance_km ?? '',
        s.passenger_count,
      ];
      if (s.passengers.length === 0) {
        rows.push([...base, '', '', ''].join(';'));
      } else {
        for (const p of s.passengers) {
          const emp = p.employee;
          rows.push([...base, emp ? `${emp.prenom} ${emp.nom}` : '', emp?.department || '', p.request_id || ''].join(';'));
        }
      }
    }
    downloadCSV('rapport_passagers.csv', [
      'Date', 'Sortie #', 'Véhicule', 'Capacité', 'Conducteur',
      'Destination', 'Heure prévue', 'Heure départ', 'Heure retour', 'Statut',
      'Km départ', 'Km arrivée', 'Distance', 'Nb passagers',
      'Passager', 'Département', 'Demande #',
    ], rows);
  };

  const reset = () => {
    setPassengerDate(null);
    setPassengerVehicle('');
    setPassengerType('');
    setPassengerTimeFrom('');
    setPassengerTimeTo('');
    setPassengerRows([]);
  };

  return (
    <div className="page-content">
      <PageHeader title={<ReportBreadcrumb active="passenger" />} subtitle="Rapport des sorties & passagers">
        <Group gap="sm">
          <DateInput
            placeholder="Date"
            valueFormat="DD/MM/YYYY"
            value={passengerDate}
            onChange={setPassengerDate}
            size="xs"
            w={{ base: '100%', sm: 150 }}
            clearable
          />
          <Button color="brand" leftSection={<IconSearch size={16} />} onClick={fetchPassengerReport} loading={passengerLoading} className="btn-action">
            Rechercher
          </Button>
        </Group>
      </PageHeader>

      <Paper p="lg" radius="lg" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon variant="light" color="brand" size={28} radius={8}>
              <IconUsers size={16} />
            </ThemeIcon>
            <Text fw={600} size="sm">{passengerRows.length} sortie{passengerRows.length !== 1 ? 's' : ''} trouvée{passengerRows.length !== 1 ? 's' : ''}</Text>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Select
              placeholder="Tous les véhicules"
              data={vehicles.map((v) => ({ value: String(v.id), label: vehicleDisplayName(v) }))}
              value={passengerVehicle}
              onChange={(v) => setPassengerVehicle(v || '')}
              clearable
              size="xs"
              w={{ base: '100%', sm: 150 }}
            />
            <Select
              placeholder="Tous types"
              data={VEHICLE_TYPE_OPTIONS}
              value={passengerType}
              onChange={(v) => setPassengerType(v || '')}
              clearable
              size="xs"
              w={{ base: '100%', sm: 120 }}
            />
            <TimeInput
              label={null}
              value={passengerTimeFrom}
              onChange={(e) => setPassengerTimeFrom(e.currentTarget.value || '')}
              size="xs"
              w={90}
            />
            <Text size="xs" c="dimmed">→</Text>
            <TimeInput
              label={null}
              value={passengerTimeTo}
              onChange={(e) => setPassengerTimeTo(e.currentTarget.value || '')}
              size="xs"
              w={90}
            />
            <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={reset}>
              Effacer
            </Button>
            {passengerRows.length > 0 && (
              <Menu shadow="lg" width={200} position="bottom-end">
                <Menu.Target>
                  <Button variant="subtle" color="gray" leftSection={<IconDownload size={14} />} size="xs">
                    Exporter
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconFileText size={14} />} onClick={() => handleExport(() => exportService.sortiesPassengersReport({
                    date: dayjs(passengerDate).format('YYYY-MM-DD'),
                    ...(passengerVehicle ? { vehicle_id: passengerVehicle } : {}),
                    ...(passengerType ? { vehicle_type: passengerType } : {}),
                    ...(passengerTimeFrom ? { time_from: passengerTimeFrom } : {}),
                    ...(passengerTimeTo ? { time_to: passengerTimeTo } : {}),
                  }, 'xlsx'))}>
                    Excel (.xlsx)
                  </Menu.Item>
                  <Menu.Item leftSection={<IconFileText size={14} />} onClick={() => handleExport(() => exportService.sortiesPassengersReport({
                    date: dayjs(passengerDate).format('YYYY-MM-DD'),
                    ...(passengerVehicle ? { vehicle_id: passengerVehicle } : {}),
                    ...(passengerType ? { vehicle_type: passengerType } : {}),
                    ...(passengerTimeFrom ? { time_from: passengerTimeFrom } : {}),
                    ...(passengerTimeTo ? { time_to: passengerTimeTo } : {}),
                  }, 'csv'))}>
                    CSV
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconDownload size={14} />} onClick={exportPassengerCSV}>
                    CSV rapide
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>

        {passengerLoading && <Text c="dimmed" size="sm">Chargement...</Text>}

        {!passengerLoading && passengerDate && passengerRows.length === 0 && (
          <Text c="dimmed" size="sm">Aucune sortie trouvée pour cette date</Text>
        )}

        {!passengerLoading && passengerRows.length > 0 && (
          <Stack gap="md">
            {passengerRows.map((s) => (
              <Paper key={s.id} p="md" radius="md" withBorder>
                <Group justify="space-between" mb="sm" wrap="wrap">
                  <Group gap="sm">
                    <Badge variant="filled" color="brand" size="lg">Sortie #{s.id}</Badge>
                    <Text fw={600} size="sm">{s.destination}</Text>
                  </Group>
                  <Group gap="xs">
                    <Badge variant="light" color={sortieStatusColor[s.status] || 'gray'}>{sortieStatusLabel[s.status] || s.status}</Badge>
                    <Badge variant="light" color="gray">{s.vehicle ? vehicleDisplayName(s.vehicle) : '—'}</Badge>
                    <Badge variant="light" color="gray">{s.vehicle?.capacity} places</Badge>
                  </Group>
                </Group>

                <SimpleGrid cols={{ base: 2, sm: 4 }} mb="sm" spacing="xs">
                  <Text size="xs" c="dimmed">Chauffeur</Text>
                  <Text size="xs">{s.driver_name}{s.driver_department ? ` (${s.driver_department})` : ''}</Text>
                  <Text size="xs" c="dimmed">Départ prévu</Text>
                  <Text size="xs">{dayjs(s.departure_time).format('HH:mm')}</Text>
                  <Text size="xs" c="dimmed">Distance</Text>
                  <Text size="xs">{s.distance_km != null ? `${s.distance_km} km` : '—'}</Text>
                  <Text size="xs" c="dimmed">Retour</Text>
                  <Text size="xs">{s.returned_at ? dayjs(s.returned_at).format('HH:mm') : '—'}</Text>
                  <Text size="xs" c="dimmed">Km départ</Text>
                  <Text size="xs">{s.departure_km ?? '—'}</Text>
                  <Text size="xs" c="dimmed">Km arrivée</Text>
                  <Text size="xs">{s.arrival_km ?? '—'}</Text>
                </SimpleGrid>

                <Divider mb="sm" />

                <Group gap="xs" mb="xs">
                  <IconUsers size={14} />
                  <Text fw={600} size="xs">Personnes à bord ({s.passenger_count} / {s.vehicle?.capacity ?? '—'})</Text>
                </Group>

                {s.passengers.length === 0 ? (
                  <Text size="xs" c="dimmed">Aucun passager enregistré</Text>
                ) : (
                  <Tablestrip passengers={s.passengers} />
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </div>
  );
}

function Tablestrip({ passengers }) {
  return (
    <Table striped highlightOnHover withTableBorder fontSize="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>#</Table.Th>
          <Table.Th>Nom &amp; prénom</Table.Th>
          <Table.Th>Département</Table.Th>
          <Table.Th>Demande</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {passengers.map((p, i) => (
          <Table.Tr key={p.request_id || i}>
            <Table.Td>{i + 1}</Table.Td>
            <Table.Td>{p.employee ? `${p.employee.prenom} ${p.employee.nom}` : '—'}</Table.Td>
            <Table.Td>{p.employee?.department || '—'}</Table.Td>
            <Table.Td>{p.request_id ? `#${p.request_id}` : '—'}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}