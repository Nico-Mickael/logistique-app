import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Text, Group, Center, Badge, SimpleGrid,
  Button, Select, ThemeIcon, Menu,
} from '@mantine/core';
import { BarChart, PieChart } from '@mantine/charts';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconRoute, IconMapPin, IconCheck, IconX, IconDownload,
  IconReportAnalytics, IconClock, IconCar, IconTool, IconBuilding,
  IconFileText,
} from '@tabler/icons-react';
import { yearOptions } from '../../utils/date';
import { statsService } from '../../api/statsService';
import { exportService } from '../../api/exportService';
import { notifyError } from '../../utils/toast';
import { requestStatusLabel, PIE_COLORS } from '../../utils/labels';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import ReportBreadcrumb from '../../components/ReportBreadcrumb';

export default function Reports() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [overview, setOverview] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isNarrow = useMediaQuery('(max-width: 399px)');

  useEffect(() => {
    statsService.fleet()
      .then(({ data }) => setFleet(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    statsService.overview({ year })
      .then(({ data }) => { if (!cancelled) setOverview(data); })
      .catch(() => { if (!cancelled) notifyError('Impossible de charger les rapports'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  const requestPieData = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.requests).map(([status, value]) => ({
      name: requestStatusLabel[status] || status,
      value,
      color: PIE_COLORS[status] || 'gray.5',
    }));
  }, [overview]);

  const totalRequests = overview ? Object.values(overview.requests).reduce((a, b) => a + b, 0) : 0;

  const handleExport = (fn) => {
    fn().catch(() => notifyError("Échec de l'export"));
  };

  if (loading && !overview) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title={<ReportBreadcrumb active="dashboard" />} subtitle={`Activité de l'année ${year}`}>
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
            </Menu.Dropdown>
          </Menu>
        </Group>
      </PageHeader>

      {overview && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl" spacing="md">
            <StatCard label="Demandes" value={totalRequests} icon={IconFileText} />
            <StatCard label="Validées" value={overview.requests.approved || 0} icon={IconCheck} />
            <StatCard label="En attente" value={overview.requests.pending || 0} icon={IconClock} />
            <StatCard label="Refusées" value={overview.requests.rejected || 0} icon={IconX} />
          </SimpleGrid>

          {fleet && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl" spacing="md">
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
                h={isNarrow ? 220 : 260}
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
                <Center>
                  <PieChart
                    h={isNarrow ? 220 : 260}
                    m="sm"
                    data={requestPieData}
                    withLabelsLine={!isMobile}
                    labelsPosition={isMobile ? 'inside' : 'outside'}
                    labelsType="percent"
                    withLabels
                    withTooltip
                  />
                </Center>
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