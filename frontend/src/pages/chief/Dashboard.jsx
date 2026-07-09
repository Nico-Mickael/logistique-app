import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Group, Badge, Loader, Center, Title, Flex, Tooltip,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { AreaChart, PieChart, BarChart } from '@mantine/charts';
import { IconFileText, IconRoute, IconCar, IconCheck, IconInbox, IconMapPin } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../api/requestService';
import { sortieService } from '../../api/sortieService';
import { vehicleService } from '../../api/vehicleService';
import { notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brandYellow', rejected: 'red', cancelled: 'dark' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée', cancelled: 'Annulée' };

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
        <div className="stat-card-icon" style={{ background: `var(--mantine-color-${color}-0)` }}>
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
      const pendingRequests = requests.filter((r) => r.status === 'pending').length;
      const ongoingSorties = sorties.filter((s) => s.status === 'ongoing').length;
      const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
      const totalKm = sorties.reduce((sum, s) => sum + Number(s.distance_km || 0), 0);
      return [
        { label: 'Demandes en attente', value: pendingRequests, icon: IconFileText, color: 'brandYellow' },
        { label: 'Sorties en cours', value: ongoingSorties, icon: IconRoute, color: 'brand' },
        { label: 'Véhicules disponibles', value: `${availableVehicles} / ${vehicles.length}`, icon: IconCar, color: 'brand' },
        { label: 'Km parcourus', value: `${totalKm} km`, icon: IconMapPin, color: 'brand' },
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

  const vehicleOccupancy = useMemo(() => {
    if (!isChief) return [];
    return vehicles.map((v) => {
      const assigned = sorties.filter((s) => s.vehicle_id === v.id && s.status !== 'finished');
      return {
        name: v.type,
        value: assigned.length,
        color: assigned.length > 0 ? 'var(--mantine-color-brand-6)' : 'var(--mantine-color-gray-3)',
      };
    }).filter((v) => v.value > 0);
  }, [isChief, vehicles, sorties]);

  const requestStatusDist = useMemo(() => {
    if (!isChief) return [];
    const counts = {};
    for (const r of requests) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    const colorMap = { pending: 'brandYellow.6', approved: 'brand.6', rejected: 'red.6', cancelled: 'gray.5', rescheduled: 'yellow.6' };
    return Object.entries(counts).map(([status, count]) => ({
      name: statusLabel[status] || status,
      value: count,
      color: colorMap[status] || 'gray.5',
    }));
  }, [isChief, requests]);

  const topDestinations = useMemo(() => {
    if (!isChief) return [];
    const counts = {};
    for (const r of requests) {
      if (r.status === 'approved') {
        counts[r.destination] = (counts[r.destination] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([dest, count]) => ({ destination: dest, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [isChief, requests]);

  const recentRequests = useMemo(
    () => [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    [requests]
  );

  if (loading) {
    return <Center h={300}><Loader color="brand" size="lg" /></Center>;
  }

  return (
    <div className="dashboard">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowgap={4}>
        <div>
          <Title order={3}>Tableau de bord</Title>
          <Text size="sm" c="dimmed" mt={2}>
            {greeting()}{user?.prenom ? `, ${user.prenom}` : ''}. Voici l'activité {isChief ? "de l'équipe" : 'de vos demandes'}.
          </Text>
        </div>
        <Text size="xs" c="dimmed" tt="capitalize">{dayjs().format('dddd D MMMM YYYY')}</Text>
      </Flex>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: isChief ? 4 : 3 }} mb="xl">
        {statsData.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={i * 80} />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: isChief ? 3 : 1 }} mb="xl">
        <Paper p="lg" radius="lg" withBorder className="dashboard-panel" style={{ gridColumn: isChief ? '1 / 3' : '1' }}>
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600}>
              {isChief ? 'Activité de la semaine' : 'Mes demandes cette semaine'}
            </Text>
            <Group rowGap={4}>
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
            h={260}
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

        {isChief && (
          <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
            <Text size="sm" fw={600} mb="md">Statut des demandes</Text>
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

      {isChief && (
        <SimpleGrid cols={{ base: 1, lg: 2 }} mb="xl">
          <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
            <Text size="sm" fw={600} mb="md">Top destinations (validées)</Text>
            {topDestinations.length === 0 ? (
              <Center h={160}>
                <Flex direction="column" align="center" gap={6}>
                  <IconMapPin size={28} color="var(--mantine-color-gray-5)" />
                  <Text c="dimmed" size="sm">Aucune destination</Text>
                </Flex>
              </Center>
            ) : (
              <DataTable
                withTableBorder={false}
                highlightOnHover
                verticalSpacing="sm"
                columns={[
                  {
                    accessor: 'rank', title: '#',
                    render: (_, i) => <Badge color="gray" variant="light" size="sm">{i + 1}</Badge>,
                    width: 60,
                  },
                  { accessor: 'destination', title: 'Destination', sortable: true },
                  {
                    accessor: 'count', title: 'Demandes',
                    render: (d) => (
                      <Tooltip label={`${d.count} demande${d.count > 1 ? 's' : ''}`}>
                        <Badge color="brand" variant="light" size="sm">{d.count}</Badge>
                      </Tooltip>
                    ),
                    textAlign: 'center',
                  },
                ]}
                records={topDestinations}
                idAccessor="destination"
              />
            )}
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
              <DataTable
                withTableBorder={false}
                highlightOnHover
                verticalSpacing="sm"
                columns={[
                  ...(isChief ? [{
                    accessor: 'employee', title: 'Employé',
                    render: (r) => `${r.Employee?.prenom || ''} ${r.Employee?.nom || ''}`,
                  }] : []),
                  { accessor: 'destination', title: 'Destination', sortable: true },
                  {
                    accessor: 'date_souhaitee', title: 'Date',
                    render: (r) => dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm'),
                  },
                  {
                    accessor: 'status', title: 'Statut',
                    render: (r) => <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status] || r.status}</Badge>,
                  },
                ]}
                records={recentRequests}
                idAccessor="id"
              />
            )}
          </Paper>
        </SimpleGrid>
      )}

      {!isChief && (
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
            <DataTable
              withTableBorder={false}
              highlightOnHover
              verticalSpacing="sm"
              columns={[
                { accessor: 'destination', title: 'Destination', sortable: true },
                {
                  accessor: 'date_souhaitee', title: 'Date',
                  render: (r) => dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm'),
                },
                {
                  accessor: 'status', title: 'Statut',
                  render: (r) => <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status] || r.status}</Badge>,
                },
              ]}
              records={recentRequests}
              idAccessor="id"
            />
          )}
        </Paper>
      )}

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
