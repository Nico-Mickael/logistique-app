import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Title, Text, Group, Loader, Center, Badge, SimpleGrid, Flex,
  Select, ThemeIcon,
} from '@mantine/core';
import { BarChart, PieChart } from '@mantine/charts';
import {
  IconFileText, IconRoute, IconMapPin, IconCheck, IconX,
  IconGauge, IconClock,
} from '@tabler/icons-react';
import { statsService } from '../../api/statsService';
import { notifyError } from '../../utils/toast';
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

export default function MyReports() {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => String(currentYear - i));
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    statsService.mine({ year })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) notifyError('Impossible de charger vos rapports'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  const requestPieData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.requests).map(([status, value]) => ({
      name: requestStatusLabel[status] || status,
      value,
      color: PIE_COLORS[status] || 'gray.5',
    }));
  }, [data]);

  const totalRequests = data ? Object.values(data.requests).reduce((a, b) => a + b, 0) : 0;

  if (loading && !data) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Mes rapports</Title>
          <Text size="sm" c="dimmed" mt={2}>Votre activité personnelle de l'année {year}</Text>
        </div>
        <Select data={yearOptions} value={year} onChange={setYear} size="xs" w={110} />
      </Flex>

      {data && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl" spacing="md">
            <StatCard label="Mes demandes" value={totalRequests} icon={IconFileText} />
            <StatCard label="Validées" value={data.requests.approved || 0} icon={IconCheck} />
            <StatCard label="En attente" value={data.requests.pending || 0} icon={IconClock} />
            <StatCard label="Refusées" value={data.requests.rejected || 0} icon={IconX} />
            <StatCard label="Km parcourus" value={data.totalKm.toLocaleString('fr-FR')} icon={IconGauge} />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mb="md">
            <Paper p="lg" radius="lg" withBorder>
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                  <IconRoute size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Kilomètres parcourus par mois ({year})</Text>
              </Group>
              <BarChart
                h={260}
                data={data.kmByMonth}
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
                <Text fw={600} size="sm">Mes demandes par statut (toutes années)</Text>
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

          <Paper p="lg" radius="lg" withBorder>
            <Group gap="sm" mb="md">
              <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                <IconMapPin size={16} />
              </ThemeIcon>
              <Text fw={600} size="sm">Mes destinations ({year})</Text>
              <Badge variant="light" color="brand">{data.totalSorties} trajet{data.totalSorties !== 1 ? 's' : ''}</Badge>
            </Group>
            {data.topDestinations.length === 0 ? (
              <Text c="dimmed" size="sm">Aucune sortie cette année</Text>
            ) : (
              <div>
                {data.topDestinations.map(({ destination, count }, i) => (
                  <Group key={destination} justify="space-between" py={6} style={{ borderBottom: i < data.topDestinations.length - 1 ? '1px solid var(--mantine-color-default-border)' : 'none' }}>
                    <Group gap="sm">
                      <Badge variant="light" color="gray" size="sm">{i + 1}</Badge>
                      <Text size="sm">{destination}</Text>
                    </Group>
                    <Badge variant="light" color="brand">{count} sortie{count !== 1 ? 's' : ''}</Badge>
                  </Group>
                ))}
              </div>
            )}
          </Paper>
        </>
      )}
    </div>
  );
}
