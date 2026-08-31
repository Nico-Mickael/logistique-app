import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Title, Text, Group, Loader, Center, Badge, SimpleGrid, Flex,
  Button, Select, ThemeIcon,
} from '@mantine/core';
import { BarChart, PieChart } from '@mantine/charts';
import { DataTable } from 'mantine-datatable';
import {
  IconFileText, IconRoute, IconMapPin, IconCheck, IconX, IconDownload,
  IconReportAnalytics, IconGauge, IconClock,
} from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { statsService } from '../../api/statsService';
import { vehicleService } from '../../api/vehicleService';
import { notifyError } from '../../utils/toast';
import { downloadCSV } from '../../utils/csv';
import { requestStatusLabel } from '../../utils/labels';

const PIE_COLORS = {
  pending: 'gray.5',
  approved: 'brand.6',
  rescheduled: 'brandYellow',
  rejected: 'red.6',
  cancelled: 'gray.3',
};

function StatCard({ label, value, icon: Icon }) {
  return (
    <Paper p="md" radius="lg" withBorder>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="xs" fw={500} tt="uppercase" c="dimmed" mb={4}>{label}</Text>
          <Text fz={22} fw={700} lh={1}>{value}</Text>
        </div>
        <ThemeIcon variant="light" color="brand" size={32} radius={10}>
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => String(currentYear - i));
  const [year, setYear] = useState(String(currentYear));
  const [overview, setOverview] = useState(null);
  const [kmRows, setKmRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vehicleService.getAll()
      .then(({ data }) => setVehicles(data || []))
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

  if (loading && !overview) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Rapports & statistiques</Title>
          <Text size="sm" c="dimmed" mt={2}>Activité de l'année {year}</Text>
        </div>
        <Group gap="sm">
          <Select data={yearOptions} value={year} onChange={setYear} size="xs" w={110} />
          <Button variant="subtle" color="gray" leftSection={<IconDownload size={16} />} onClick={exportKmCSV} size="sm">
            Export CSV
          </Button>
        </Group>
      </Flex>

      {overview && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl" spacing="md">
            <StatCard label="Demandes" value={totalRequests} icon={IconFileText} />
            <StatCard label="Validées" value={overview.requests.approved || 0} icon={IconCheck} />
            <StatCard label="En attente" value={overview.requests.pending || 0} icon={IconClock} />
            <StatCard label="Refusées" value={overview.requests.rejected || 0} icon={IconX} />
            <StatCard label="Km parcourus" value={overview.totalKm.toLocaleString('fr-FR')} icon={IconGauge} />
          </SimpleGrid>

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
