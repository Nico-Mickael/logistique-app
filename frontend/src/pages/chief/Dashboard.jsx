import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Group, Badge, Loader, Center, Title, Flex, ThemeIcon,
} from '@mantine/core';
import { AreaChart, PieChart } from '@mantine/charts';
import { IconFileText, IconRoute, IconCar, IconCheck, IconMapPin, IconX, IconCalendarRepeat } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../api/requestService';
import { sortieService } from '../../api/sortieService';
import { vehicleService } from '../../api/vehicleService';
import { notifyError } from '../../utils/toast';
import { requestStatusLabel as statusLabel } from '../../utils/labels';

function StatCard({ label, value, icon: Icon, delay }) {
  return (
    <Paper
      p="md"
      radius="lg"
      className="stat-card"
      style={{ '--stat-delay': `${delay}ms`, background: '#fff', border: '1px solid #e0e0e0' }}
      shadow="xs"
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="xs" fw={500} tt="uppercase" c="dimmed" mb={4}>{label}</Text>
          <Text fz={22} fw={700} lh={1}>{value}</Text>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(46,125,50,0.08)', flexShrink: 0,
        }}>
          <Icon size={18} color="#2E7D32" />
        </div>
      </Group>
    </Paper>
  );
}

function greeting() {
  const h = dayjs().hour();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function Dashboard() {
  const { user } = useAuth();
  const isChief = user?.role === 'logistics_chief' || user?.role === 'admin' || user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [sorties, setSorties] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (isChief) {
          const [requestsRes, sortiesRes, vehiclesRes] = await Promise.all([
            requestService.all({ limit: 9999 }),
            sortieService.getAll({ limit: 9999 }),
            vehicleService.getAll(),
          ]);
          setRequests(requestsRes.data.data || requestsRes.data || []);
          setSorties(sortiesRes.data.data || sortiesRes.data || []);
          setVehicles(vehiclesRes.data || []);
        } else {
          const requestsRes = await requestService.mine();
          setRequests(requestsRes.data || []);
        }
      } catch {
        notifyError('Impossible de charger les données du tableau de bord');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isChief]);

  const statsData = useMemo(() => {
    if (isChief) {
      return [
        { label: 'Demandes en attente', value: requests.filter((r) => r.status === 'pending').length, icon: IconFileText, color: 'brand' },
        { label: 'Sorties en cours', value: sorties.filter((s) => s.status === 'ongoing').length, icon: IconRoute, color: 'brand' },
        { label: 'Véhicules dispo', value: `${vehicles.filter((v) => v.status === 'available').length} / ${vehicles.length}`, icon: IconCar, color: 'brand' },
        { label: 'Km parcourus', value: `${sorties.reduce((sum, s) => sum + Number(s.distance_km || 0), 0)}`, icon: IconMapPin, color: 'gray' },
        { label: 'Refusées', value: requests.filter((r) => r.status === 'rejected').length, icon: IconX, color: 'gray' },
        { label: 'Replanifiées', value: requests.filter((r) => r.status === 'rescheduled').length, icon: IconCalendarRepeat, color: 'gray' },
      ];
    }
    return [
      { label: 'Mes demandes', value: requests.length, icon: IconFileText, color: 'brand' },
      { label: 'En attente', value: requests.filter((r) => r.status === 'pending').length, icon: IconRoute, color: 'gray' },
      { label: 'Validées', value: requests.filter((r) => r.status === 'approved').length, icon: IconCheck, color: 'brand' },
    ];
  }, [isChief, requests, sorties, vehicles]);

  const chartData = useMemo(() => {
    const labels = [];
    const map = {};
    for (let i = 6; i >= 0; i -= 1) {
      const day = dayjs().subtract(i, 'day');
      const key = day.format('YYYY-MM-DD');
      labels.push(key);
      map[key] = { date: day.format('ddd'), sorties: 0 };
    }
    const source = isChief ? sorties : requests;
    const timeKey = isChief ? 'departure_time' : 'createdAt';
    for (const item of source) {
      const key = dayjs(item[timeKey]).format('YYYY-MM-DD');
      if (map[key]) map[key].sorties += 1;
    }
    return labels.map((k) => map[k]);
  }, [isChief, sorties, requests]);

  const requestStatusDist = useMemo(() => {
    if (!isChief) return [];
    const counts = {};
    for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1;
    const colorMap = { pending: 'gray.5', approved: 'brand.6', rejected: 'gray.4', cancelled: 'gray.3', rescheduled: 'gray.5' };
    return Object.entries(counts).map(([status, count]) => ({
      name: statusLabel[status] || status, value: count, color: colorMap[status] || 'gray.5',
    }));
  }, [isChief, requests]);

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="dashboard">
      <Flex justify="space-between" align="flex-end" mb="xl" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3} fw={700}>
            {greeting()}{user?.prenom ? `, ${user.prenom}` : ''}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Voici l'activité {isChief ? "de l'équipe" : 'de vos demandes'}.
          </Text>
        </div>
        <Badge variant="light" color="brandYellow" size="lg" radius="md" tt="capitalize">
          {dayjs().format('dddd D MMMM YYYY')}
        </Badge>
      </Flex>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="xl" spacing="md">
        {statsData.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={i * 60} />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: isChief ? 2 : 1 }} spacing="md">
        <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
          <Group justify="space-between" mb="md">
            <Group gap="sm">
              <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                <IconRoute size={16} />
              </ThemeIcon>
              <Text fw={600} size="sm">{isChief ? 'Activité de la semaine' : 'Mes demandes cette semaine'}</Text>
            </Group>
            <Group gap={6}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-brand-6)', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">{isChief ? 'Sorties' : 'Demandes'}</Text>
            </Group>
          </Group>
          <AreaChart
            h={260}
            data={chartData}
            dataKey="date"
            withLegend={false}
            series={[
              { name: 'sorties', color: 'brand.6', label: isChief ? 'Sorties' : 'Demandes' },
            ]}
            curveType="monotone"
            withGradient
            gridAxis="x"
            tickLine="x"
          />
        </Paper>

        {isChief && (
          <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
            <Group gap="sm" mb="md">
              <ThemeIcon variant="light" color="brand" size={28} radius={8}>
                <IconFileText size={16} />
              </ThemeIcon>
              <Text fw={600} size="sm">Statut des demandes</Text>
            </Group>
            {requestStatusDist.length === 0 ? (
              <Center h={200}><Text c="dimmed" size="sm">Aucune donnée</Text></Center>
            ) : (
              <PieChart
                h={220}
                data={requestStatusDist}
                withLabelsLine
                labelsPosition="outside"
                labelsType="percent"
                withLabels
                withTooltip
                tooltipDataSource="segment"
                mx="auto"
              />
            )}
          </Paper>
        )}
      </SimpleGrid>

      <style>{`
        .stat-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: stat-in 0.5s ease-out backwards;
          animation-delay: var(--stat-delay, 0ms);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.08);
        }
        .dashboard-panel {
          animation: panel-in 0.4s ease-out;
        }
        @keyframes stat-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-card, .dashboard-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
