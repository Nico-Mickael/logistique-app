import { useEffect, useState } from 'react';
import {
  Paper, Title, Table, Badge, Loader, Center, Text, Group, Button, Card,
  SimpleGrid, Stack, Flex,
} from '@mantine/core';
import { IconCheck, IconX, IconInbox } from '@tabler/icons-react';
import dayjs from 'dayjs';
import Swal from 'sweetalert2';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brandYellow', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

function RequestCard({ request, onRespond }) {
  return (
    <Card withBorder radius="lg" p="lg" className="request-card">
      <div className="stat-card-accent" style={{
        background: request.status === 'approved' ? 'var(--mantine-color-brand-6)' :
                     request.status === 'rejected' ? 'var(--mantine-color-red-6)' :
                     request.status === 'rescheduled' ? 'var(--mantine-color-brandYellow-6)' :
                     'var(--mantine-color-gray-5)'
      }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="md">{request.destination}</Text>
        <Badge color={statusColor[request.status]} variant="light">
          {statusLabel[request.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed" size="sm">Motif: </Text>{request.motif}</Text>
        <Text size="sm"><Text span c="dimmed" size="sm">Date: </Text>
          {dayjs(request.date_souhaitee).format('DD/MM/YYYY HH:mm')}
        </Text>
        <Text size="sm"><Text span c="dimmed" size="sm">Personnes: </Text>{request.nb_personnes}</Text>
      </Stack>
      {request.status === 'rescheduled' && (
        <Group gap="xs">
          <Button size="xs" color="brand" leftSection={<IconCheck size={14} />}
            onClick={() => onRespond(request.id, true)}
          >
            Accepter
          </Button>
          <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />}
            onClick={() => onRespond(request.id, false)}
          >
            Refuser
          </Button>
        </Group>
      )}
    </Card>
  );
}

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const { data } = await requestService.mine();
      setRequests(data);
    } catch {
      notifyError('Impossible de charger vos demandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleRespond = async (id, accepted) => {
    const action = accepted ? 'accepter' : 'refuser';
    const result = await Swal.fire({
      title: `${accepted ? 'Accepter' : 'Refuser'} la replanification ?`,
      text: accepted ? 'Vous confirmez la nouvelle date proposée.' : 'Votre demande sera annulée.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Oui, ${action}`,
      cancelButtonText: 'Annuler',
      confirmButtonColor: accepted ? '#2E7D32' : '#D32F2F',
      cancelButtonColor: '#8C8C8C',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await requestService.respondReschedule(id, accepted);
      notifySuccess(accepted ? 'Nouvelle date acceptée' : 'Replanification refusée');
      fetchRequests();
    } catch { notifyError('Erreur lors de la réponse'); }
  };

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Mes demandes</Title>
          <Text size="sm" c="dimmed" mt={2}>{requests.length} demande{requests.length !== 1 ? 's' : ''}</Text>
        </div>
      </Flex>

      {requests.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconInbox size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucune demande pour le moment</Text>
            </Flex>
          </Center>
        </Paper>
      ) : (
        <>
          <div className="hide-on-mobile">
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <Table.ScrollContainer minWidth={500}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Destination</Table.Th>
                      <Table.Th>Motif</Table.Th>
                      <Table.Th>Date souhaitée</Table.Th>
                      <Table.Th>Personnes</Table.Th>
                      <Table.Th>Statut</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {requests.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td fw={500}>{r.destination}</Table.Td>
                        <Table.Td>{r.motif}</Table.Td>
                        <Table.Td>{dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Table.Td>
                        <Table.Td>{r.nb_personnes}</Table.Td>
                        <Table.Td>
                          <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status]}</Badge>
                        </Table.Td>
                        <Table.Td>
                          {r.status === 'rescheduled' && (
                            <Group gap="xs" wrap="nowrap">
                              <Button size="xs" color="brand" leftSection={<IconCheck size={14} />}
                                onClick={() => handleRespond(r.id, true)}
                              >
                                Accepter
                              </Button>
                              <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />}
                                onClick={() => handleRespond(r.id, false)}
                              >
                                Refuser
                              </Button>
                            </Group>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </div>

          <div className="hide-on-tablet-up">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} onRespond={handleRespond} />
              ))}
            </SimpleGrid>
          </div>
        </>
      )}

      <style>{`
        .request-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        .stat-card-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }
        .dashboard-panel {
          animation: panel-in 0.4s ease-out;
        }
        @keyframes panel-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .request-card, .dashboard-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default MyRequests;
