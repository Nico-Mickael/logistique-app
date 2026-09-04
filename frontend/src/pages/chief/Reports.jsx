import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Text, Group, Center, Badge, SimpleGrid, Stack,
  Button, Select, ThemeIcon, Menu, Divider, Table,
} from '@mantine/core';
import { BarChart, PieChart } from '@mantine/charts';
import { DataTable } from 'mantine-datatable';
import { DateInput } from '@mantine/dates';
import {
  IconFileText, IconRoute, IconMapPin, IconCheck, IconX, IconDownload,
  IconReportAnalytics, IconGauge, IconClock, IconCar, IconTool,
  IconBuilding, IconUsers, IconSearch,
} from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { yearOptions } from '../../utils/date';
import { statsService } from '../../api/statsService';
import { vehicleService } from '../../api/vehicleService';
import { exportService } from '../../api/exportService';
import { notifyError } from '../../utils/toast';
import { downloadCSV } from '../../utils/csv';
import { requestStatusLabel, PIE_COLORS } from '../../utils/labels';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';

export default function Reports() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [overview, setOverview] = useState(null);
  const [kmRows, setKmRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fleet, setFleet] = useState(null);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [passengerDate, setPassengerDate] = useState(null);
  const [passengerVehicle, setPassengerVehicle] = useState('');
  const [passengerRows, setPassengerRows] = useState([]);
  const [passengerLoading, setPassengerLoading] = useState(false);

  useEffect(() => {
    vehicleService.getAll()
      .then(({ data }) => setVehicles(data || []))
      .catch(() => {});
    statsService.fleet()
      .then(({ data }) => setFleet(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      statsService.overview({ year }),
      statsService.kilometrage({ year, ...(vehicleFilter ? { vehicle_id: vehicleFilter } : {}) }),
    ])
      .then(([overviewRes, kmRes]) => {
        if (cancelled) return;
        setOverview(overviewRes.data);
        setKmRows(kmRes.data || []);
      })
      .catch(() => { if (!cancelled) notifyError('Impossible de charger les rapports'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, vehicleFilter]);

  const requestPieData = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.requests).map(([status, value]) => ({
      name: requestStatusLabel[status] || status,
      value,
      color: PIE_COLORS[status] || 'gray.5',
    }));
  }, [overview]);

  const totalRequests = overview ? Object.values(overview.requests).reduce((a, b) => a + b, 0) : 0;

  const exportKmCSV = () => {
    downloadCSV('kilometrage.csv',
      ['Date', 'Véhicule', 'Conducteur', 'Destination', 'Km départ', 'Km arrivée', 'Distance'],
      kmRows.map((s) => [
        dayjs(s.departure_time).format('DD/MM/YYYY'),
        s.Vehicle?.type || '',
        s.driver_name,
        s.destination,
        s.departure_km ?? '',
        s.arrival_km ?? '',
        s.distance_km ?? '',
      ].join(';'))
    );
  };

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
        s.vehicle?.type || '',
        s.vehicle?.capacity ?? '',
        s.driver_name,
        s.destination,
        s.departed_at ? dayjs(s.departed_at).format('HH:mm') : '',
        s.returned_at ? dayjs(s.returned_at).format('HH:mm') : '',
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
      'Destination', 'Heure départ', 'Heure retour',
      'Km départ', 'Km arrivée', 'Distance', 'Nb passagers',
      'Passager', 'Département', 'Demande #',
    ], rows);
  };

  if (loading && !overview) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Rapports & statistiques" subtitle={`Activité de l'année ${year}`}>
        <Group gap="sm">
          <Select data={yearOptions} value={year} onChange={setYear} size="xs" w={110} />
          <Menu shadow="lg" width={230} position="bottom-end">
            <Menu.Target>
              <Button variant="subtle" color="gray" leftSection={<IconDownload size={16} />} size="sm">
                Exporter
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Retours Excel (.xlsx)</Menu.Label>
              <Menu.Item leftSection={<IconBuilding size={16} />} onClick={() => handleExport(() => exportService.fleetReport('xlsx'))}>
                Rapport flotte
              </Menu.Item>
              <Menu.Item leftSection={<IconRoute size={16} />} onClick={() => handleExport(() => exportService.sortiesReport({ status: 'finished' }, 'xlsx'))}>
                Rapport sorties
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>CSV (Excel)</Menu.Label>
              <Menu.Item leftSection={<IconCar size={16} />} onClick={exportKmCSV}>
                Kilométrage ({year})
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </PageHeader>

      {overview && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl" spacing="md">
            <StatCard label="Demandes" value={totalRequests} icon={IconFileText} />
            <StatCard label="Validées" value={overview.requests.approved || 0} icon={IconCheck} />
            <StatCard label="En attente" value={overview.requests.pending || 0} icon={IconClock} />
            <StatCard label="Refusées" value={overview.requests.rejected || 0} icon={IconX} />
            <StatCard label="Km parcourus" value={overview.totalKm.toLocaleString('fr-FR')} icon={IconGauge} />
          </SimpleGrid>

          {fleet && (
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl" spacing="md">
              <StatCard label="Véhicules" value={fleet.vehicles?.total ?? '—'} icon={IconCar} />
              <StatCard label="Disponibles" value={fleet.vehicles?.byStatus?.available ?? 0} icon={IconCar} />
              <StatCard label="En maintenance" value={(fleet.vehicles?.byStatus?.maintenance ?? 0) + (fleet.vehicles?.byStatus?.broken ?? 0)} icon={IconTool} />
            </SimpleGrid>
          )}

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mb="md">
            <Paper p="lg" radius="lg" withBorder>
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconMapPin size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Kilomètres parcourus par mois</Text>
              </Group>
              <BarChart
                h={260}
                data={overview.kmByMonth}
                dataKey="month"
                series={[{ name: 'km', color: 'brand.6', label: 'Km' }]}
                withTooltip
                gridAxis="y"
              />
            </Paper>

            <Paper p="lg" radius="lg" withBorder>
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconFileText size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Demandes par statut (toutes années)</Text>
              </Group>
              {requestPieData.length === 0 ? (
                <Center h={200}><Text c="dimmed" size="sm">Aucune donnée</Text></Center>
              ) : (
                <PieChart
                  h={260}
                  data={requestPieData}
                  withLabelsLine
                  labelsPosition="outside"
                  labelsType="percent"
                  withLabels
                  withTooltip
                />
              )}
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mb="md">
            <Paper p="lg" radius="lg" withBorder>
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconRoute size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Top destinations ({year})</Text>
              </Group>
              {overview.topDestinations.length === 0 ? (
                <Text c="dimmed" size="sm">Aucune sortie cette année</Text>
              ) : (
                <StackGapList destinations={overview.topDestinations} />
              )}
            </Paper>

            <Paper p="lg" radius="lg" withBorder>
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconReportAnalytics size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Flotte de véhicules</Text>
              </Group>
              <Group gap="xs">
                {Object.entries(overview.vehicles).map(([status, count]) => (
                  <Badge key={status} variant="light" color={status === 'available' ? 'brand' : status === 'busy' ? 'brandYellow' : 'red'}>
                    {count} {status}
                  </Badge>
                ))}
              </Group>
            </Paper>
          </SimpleGrid>

          <Paper p="lg" radius="lg" withBorder>
            <Group justify="space-between" mb="md" wrap="wrap">
              <Group gap="sm">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconGauge size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Historique kilométrique ({kmRows.length})</Text>
              </Group>
              <Select
                placeholder="Tous les véhicules"
                data={vehicles.map((v) => ({ value: String(v.id), label: v.type }))}
                value={vehicleFilter}
                onChange={(v) => setVehicleFilter(v || '')}
                clearable
                size="xs"
                w={180}
              />
            </Group>
            <DataTable
              withTableBorder
              borderRadius="md"
              highlightOnHover
              verticalSpacing="sm"
              idAccessor="id"
              records={kmRows}
              recordsPerPage={10}
              paginationSize="sm"
              paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
              columns={[
                { accessor: 'departure_time', title: 'Date', render: (s) => dayjs(s.departure_time).format('DD/MM/YYYY') },
                { accessor: 'vehicle', title: 'Véhicule', render: (s) => <Text tt="capitalize">{s.Vehicle?.type}</Text> },
                { accessor: 'driver_name', title: 'Conducteur' },
                { accessor: 'destination', title: 'Destination' },
                { accessor: 'departure_km', title: 'Km départ', textAlign: 'right' },
                { accessor: 'arrival_km', title: 'Km arrivée', textAlign: 'right' },
                { accessor: 'distance_km', title: 'Distance', textAlign: 'right', render: (s) => <Badge variant="light" color="brand">{s.distance_km} km</Badge> },
              ]}
            />
          </Paper>

          <Paper p="lg" radius="lg" withBorder mt="md">
            <Group justify="space-between" mb="md" wrap="wrap">
              <Group gap="sm">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconUsers size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Rapport des sorties &amp; passagers</Text>
              </Group>
              <Group gap="xs">
                <DateInput
                  placeholder="Date"
                  valueFormat="DD/MM/YYYY"
                  value={passengerDate}
                  onChange={setPassengerDate}
                  size="xs"
                  w={150}
                  clearable
                />
                <Select
                  placeholder="Tous les véhicules"
                  data={vehicles.map((v) => ({ value: String(v.id), label: v.type }))}
                  value={passengerVehicle}
                  onChange={(v) => setPassengerVehicle(v || '')}
                  clearable
                  size="xs"
                  w={160}
                />
                <Button
                  color="brand"
                  leftSection={<IconSearch size={16} />}
                  onClick={fetchPassengerReport}
                  loading={passengerLoading}
                  className="btn-action"
                >
                  Rechercher
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  leftSection={<IconX size={14} />}
                  onClick={() => { setPassengerDate(null); setPassengerVehicle(''); setPassengerRows([]); }}
                >
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
                      <Menu.Item leftSection={<IconFileText size={14} />} onClick={() => handleExport(() => exportService.sortiesPassengersReport({ date: dayjs(passengerDate).format('YYYY-MM-DD'), ...(passengerVehicle ? { vehicle_id: passengerVehicle } : {}) }, 'xlsx'))}>
                        Excel (.xlsx)
                      </Menu.Item>
                      <Menu.Item leftSection={<IconFileText size={14} />} onClick={() => handleExport(() => exportService.sortiesPassengersReport({ date: dayjs(passengerDate).format('YYYY-MM-DD'), ...(passengerVehicle ? { vehicle_id: passengerVehicle } : {}) }, 'csv'))}>
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
                        <Badge variant="light" color="gray">{s.vehicle?.type}</Badge>
                        <Badge variant="light" color="gray">{s.vehicle?.capacity} places</Badge>
                      </Group>
                    </Group>

                    <SimpleGrid cols={{ base: 2, sm: 4 }} mb="sm" spacing="xs">
                      <Text size="xs" c="dimmed">Chauffeur</Text>
                      <Text size="xs">{s.driver_name}</Text>
                      <Text size="xs" c="dimmed">Départ</Text>
                      <Text size="xs">{s.departed_at ? dayjs(s.departed_at).format('HH:mm') : '—'}</Text>
                      <Text size="xs" c="dimmed">Retour</Text>
                      <Text size="xs">{s.returned_at ? dayjs(s.returned_at).format('HH:mm') : '—'}</Text>
                      <Text size="xs" c="dimmed">Distance</Text>
                      <Text size="xs">{s.distance_km != null ? `${s.distance_km} km` : '—'}</Text>
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
        </>
      )}
    </div>
  );
}

function StackGapList({ destinations }) {
  return (
    <div>
      {destinations.map(({ destination, count }, i) => (
        <Group key={destination} justify="space-between" py={6} style={{ borderBottom: i < destinations.length - 1 ? '1px solid var(--mantine-color-default-border)' : 'none' }}>
          <Group gap="sm">
            <Badge variant="light" color="gray" size="sm">{i + 1}</Badge>
            <Text size="sm">{destination}</Text>
          </Group>
          <Badge variant="light" color="brand">{count} sortie{count !== 1 ? 's' : ''}</Badge>
        </Group>
      ))}
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
