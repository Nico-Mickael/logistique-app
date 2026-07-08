import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Group, Badge, Table, Loader, Center, Title, Flex,
} from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { IconFileText, IconRoute, IconCar, IconCheck, IconInbox } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../api/requestService';
import { sortieService } from '../../api/sortieService';
import { vehicleService } from '../../api/vehicleService';
import { notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brandYellow', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

function buildWeekChartData(sorties) {
  const labels = [];
  const map = {};

  for (let i = 6; i >= 0; i -= 1) {
    const day = dayjs().subtract(i, 'day');
    const key = day.format('YYYY-MM-DD');
    labels.push(key);
    map[key] = {
      date: day.format('ddd'),
      sorties: 0,
      km: 0,
    };
  }

  for (const sortie of sorties) {
    const key = dayjs(sortie.departure_time).format('YYYY-MM-DD');
    if (map[key]) {
      map[key].sorties += 1;
      map[key].km += Number(sortie.distance_km || 0);
    }
  }

  return labels.map((k) => map[k]);
}

function StatCard({ label, value, icon: Icon, color, delay }) {
  return (
    <Paper
      p="lg"
      radius="lg"
      withBorder
      className="stat-card"
      style={{ '--stat-delay': `${delay}ms` }}
    >
      <div className="stat-card-accent" style={{ background: `var(--mantine-color-${color}-6)` }} />
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{label}</Text>
          <Text size="xl" fw={700} mt={4}>{value}</Text>
        </div>
        <div
          className="stat-card-icon"
          style={{ background: `var(--mantine-color-${color}-0)` }}
        >
          <Icon size={22} color={`var(--mantine-color-${color}-6)`} />
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
  const isChief = user?.role === 'logistics_chief' || user?.role === 'admin';

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
            requestService.all(),
            sortieService.getAll(),
            vehicleService.getAll(),
          ]);
          setRequests(requestsRes.data || []);
          setSorties(sortiesRes.data || []);
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
      const pendingRequests = requests.filter((r) => r.status === 'pending').length;
      const ongoingSorties = sorties.filter((s) => s.status === 'ongoing').length;
      const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
      return [
        { label: 'Demandes en attente', value: pendingRequests, icon: IconFileText, color: 'brandYellow' },
        { label: 'Sorties en cours', value: ongoingSorties, icon: IconRoute, color: 'brand' },
        { label: 'Véhicules disponibles', value: `${availableVehicles} / ${vehicles.length}`, icon: IconCar, color: 'brand' },
      ];
    }
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    return [
      { label: 'Mes demandes', value: requests.length, icon: IconFileText, color: 'brand' },
      { label: 'En attente', value: pending, icon: IconRoute, color: 'brandYellow' },
      { label: 'Validées', value: approved, icon: IconCheck, color: 'brand' },
    ];
  }, [isChief, requests, sorties, vehicles]);

  const chartData = useMemo(() => {
    if (isChief) return buildWeekChartData(sorties);
    return buildWeekChartData(
      requests.map((r) => ({ departure_time: r.createdAt, distance_km: 0 }))
    );
  }, [isChief, sorties, requests]);

  const recentRequests = useMemo(
    () => [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    [requests]
  );

  if (loading) {
    return <Center h={300}><Loader color="brand" size="lg" /></Center>;
  }

  return (
    <div className="dashboard">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Tableau de bord</Title>
          <Text size="sm" c="dimmed" mt={2}>
            {greeting()}{user?.prenom ? `, ${user.prenom}` : ''}. Voici l'activité {isChief ? "de l'équipe" : 'de vos demandes'}.
          </Text>
        </div>
        <Text size="xs" c="dimmed" tt="capitalize">{dayjs().format('dddd D MMMM YYYY')}</Text>
      </Flex>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="xl">
        {statsData.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={i * 80} />
        ))}
      </SimpleGrid>

      <Paper p="lg" radius="lg" withBorder mb="xl" className="dashboard-panel">
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={600}>
            {isChief ? 'Activité de la semaine' : 'Mes demandes cette semaine'}
          </Text>
          <Group gap="md">
            <Group gap={6}>
              <span className="legend-dot" style={{ background: 'var(--mantine-color-brand-6)' }} />
              <Text size="xs" c="dimmed">{isChief ? 'Sorties' : 'Demandes'}</Text>
            </Group>
            <Group gap={6}>
              <span className="legend-dot" style={{ background: 'var(--mantine-color-brandYellow-5)' }} />
              <Text size="xs" c="dimmed">Km parcourus</Text>
            </Group>
          </Group>
        </Group>
        <AreaChart
          h={280}
          data={chartData}
          dataKey="date"
          withLegend={false}
          series={[
            { name: 'sorties', color: 'brand.6', label: isChief ? 'Sorties' : 'Demandes' },
            { name: 'km', color: 'brandYellow.5', label: 'Km parcourus' },
          ]}
          curveType="monotone"
          withGradient
          gridAxis="xy"
          tickLine="xy"
        />
      </Paper>

      <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
        <Text size="sm" fw={600} mb="md">Demandes récentes</Text>
        {recentRequests.length === 0 ? (
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconInbox size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucune demande à afficher</Text>
            </Flex>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={500}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {isChief && <Table.Th>Employé</Table.Th>}
                  <Table.Th>Destination</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Statut</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentRequests.map((r) => (
                  <Table.Tr key={r.id}>
                    {isChief && <Table.Td>{r.Employee?.prenom} {r.Employee?.nom}</Table.Td>}
                    <Table.Td>{r.destination}</Table.Td>
                    <Table.Td>{dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColor[r.status]} variant="light">
                        {statusLabel[r.status] || r.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <style>{`
        .stat-card {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: stat-in 0.4s ease-out backwards;
          animation-delay: var(--stat-delay, 0ms);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }

        .stat-card-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }

        .stat-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dashboard-panel {
          animation: panel-in 0.4s ease-out;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        @keyframes stat-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes panel-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .stat-card, .dashboard-panel {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;