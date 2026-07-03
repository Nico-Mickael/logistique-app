import { SimpleGrid, Paper, Text, Group, Badge, Table } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { IconFileText, IconRoute, IconCar } from '@tabler/icons-react';

const statsData = [
  { label: 'Demandes en attente', value: 5, icon: IconFileText, color: 'gray' },
  { label: 'Sorties en cours', value: 2, icon: IconRoute, color: 'brand' },
  { label: 'Véhicules disponibles', value: '7 / 10', icon: IconCar, color: 'brand' },
];

const chartData = [
  { date: 'Lun', sorties: 3, km: 120 },
  { date: 'Mar', sorties: 5, km: 210 },
  { date: 'Mer', sorties: 2, km: 90 },
  { date: 'Jeu', sorties: 6, km: 260 },
  { date: 'Ven', sorties: 4, km: 175 },
];

const recentRequests = [
  { employee: 'Marie Rasoa', destination: 'Antananarivo', status: 'approved' },
  { employee: 'Paul Andria', destination: 'Toamasina', status: 'pending' },
  { employee: 'Hery Rabe', destination: 'Fianarantsoa', status: 'rescheduled' },
];

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'yellow', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

function Dashboard() {
  return (
    <>
      <Text size="xl" fw={600} mb="md">Tableau de bord</Text>

      {/* Cartes stats */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        {statsData.map((stat) => (
          <Paper key={stat.label} p="md" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">{stat.label}</Text>
                <Text size="xl" fw={700}>{stat.value}</Text>
              </div>
              <stat.icon size={28} color="var(--mantine-color-brand-6)" />
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {/* Graphique */}
      <Paper p="md" radius="md" withBorder mb="lg">
        <Text size="sm" fw={500} mb="md">Activité de la semaine</Text>
        <AreaChart
          h={260}
          data={chartData}
          dataKey="date"
          series={[
            { name: 'sorties', color: 'brand.6', label: 'Sorties' },
            { name: 'km', color: 'brand.3', label: 'Km parcourus' },
          ]}
          curveType="monotone"
          withGradient
          gridAxis="xy"
        />
      </Paper>

      {/* Table des demandes récentes */}
      <Paper p="md" radius="md" withBorder>
        <Text size="sm" fw={500} mb="md">Demandes récentes</Text>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Employé</Table.Th>
              <Table.Th>Destination</Table.Th>
              <Table.Th>Statut</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recentRequests.map((r, i) => (
              <Table.Tr key={i}>
                <Table.Td>{r.employee}</Table.Td>
                <Table.Td>{r.destination}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor[r.status]} variant="light">
                    {statusLabel[r.status]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </>
  );
}

export default Dashboard;