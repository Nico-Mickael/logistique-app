import { useEffect, useState } from 'react';
import { Paper, Title, Table, Badge, Loader, Center, Text } from '@mantine/core';
import { requestService } from '../../api/requestService';
import { notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brand.3', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const { data } = await requestService.mine();
        setRequests(data);
      } catch (err) {
        notifyError('Impossible de charger vos demandes');
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  if (loading) {
    return (
      <Center h={200}>
        <Loader color="brand" />
      </Center>
    );
  }

  return (
    <Paper p="lg" radius="md" withBorder>
      <Title order={4} mb="md">Mes demandes</Title>

      {requests.length === 0 ? (
        <Center h={120}>
          <Text c="dimmed" size="sm">Aucune demande pour le moment</Text>
        </Center>
      ) : (
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Destination</Table.Th>
              <Table.Th>Motif</Table.Th>
              <Table.Th>Date souhaitée</Table.Th>
              <Table.Th>Personnes</Table.Th>
              <Table.Th>Statut</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requests.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.destination}</Table.Td>
                <Table.Td>{r.motif}</Table.Td>
                <Table.Td>{new Date(r.date_souhaitee).toLocaleString('fr-FR')}</Table.Td>
                <Table.Td>{r.nb_personnes}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor[r.status]} variant="light">
                    {statusLabel[r.status]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}

export default MyRequests;