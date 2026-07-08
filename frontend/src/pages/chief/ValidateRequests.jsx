import { useEffect, useState } from 'react';
import {
  Paper, Title, Table, Badge, Loader, Center, Text, Group, Button, Modal,
  TextInput, Stack, Card, SimpleGrid, Flex,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconX, IconCalendar, IconInbox } from '@tabler/icons-react';
import dayjs from 'dayjs';
import Swal from 'sweetalert2';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brandYellow', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

function RequestCard({ request, onApprove, onReject, onReschedule }) {
  return (
    <Card withBorder radius="lg" p="lg" className="request-card">
      <div className="stat-card-accent" style={{ background: 'var(--mantine-color-brandYellow-6)' }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="md">{request.destination}</Text>
        <Badge color={statusColor[request.status]} variant="light">
          {statusLabel[request.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm">
          <Text span c="dimmed" size="sm">Employé: </Text>
          {request.Employee?.prenom} {request.Employee?.nom}
        </Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Motif: </Text>{request.motif}
        </Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Date: </Text>
          {dayjs(request.date_souhaitee).format('DD/MM/YYYY HH:mm')}
        </Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Personnes: </Text>{request.nb_personnes}
        </Text>
      </Stack>
      {request.status === 'pending' && (
        <Group gap="xs">
          <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => onApprove(request.id)}>
            Valider
          </Button>
          <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => onReschedule(request)}>
            Replanifier
          </Button>
          <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => onReject(request.id)}>
            Refuser
          </Button>
        </Group>
      )}
    </Card>
  );
}

function ValidateRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newDate, setNewDate] = useState(null);

  const fetchRequests = async () => {
    try {
      const { data } = await requestService.all();
      setRequests(data);
    } catch {
      notifyError('Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleApprove = async (id) => {
    try {
      await requestService.updateStatus(id, 'approved');
      notifySuccess('Demande validée');
      fetchRequests();
    } catch { notifyError('Erreur lors de la validation'); }
  };

  const handleReject = async (id) => {
    const result = await Swal.fire({
      title: 'Refuser cette demande ?',
      text: "L'employé sera notifié du refus.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, refuser',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#D32F2F',
      cancelButtonColor: '#8C8C8C',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await requestService.updateStatus(id, 'rejected');
      notifySuccess('Demande refusée');
      fetchRequests();
    } catch { notifyError('Erreur lors du refus'); }
  };

  const openRescheduleModal = (request) => {
    setSelectedRequest(request);
    setNewDate(null);
    open();
  };

  const handleReschedule = async () => {
    if (!newDate) { notifyError('Choisissez une nouvelle date'); return; }
    try {
      await requestService.updateStatus(selectedRequest.id, 'rescheduled', newDate);
      notifySuccess('Proposition de replanification envoyée');
      close();
      fetchRequests();
    } catch { notifyError('Erreur lors de la replanification'); }
  };

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Demandes à valider</Title>
          <Text size="sm" c="dimmed" mt={2}>{requests.length} demande{requests.length !== 1 ? 's' : ''} au total</Text>
        </div>
      </Flex>

      {requests.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconInbox size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucune demande à valider</Text>
            </Flex>
          </Center>
        </Paper>
      ) : (
        <>
          <div className="hide-on-mobile">
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <Table.ScrollContainer minWidth={600}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Employé</Table.Th>
                      <Table.Th>Destination</Table.Th>
                      <Table.Th>Date souhaitée</Table.Th>
                      <Table.Th>Personnes</Table.Th>
                      <Table.Th>Statut</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {requests.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td>{r.Employee?.prenom} {r.Employee?.nom}</Table.Td>
                        <Table.Td fw={500}>{r.destination}</Table.Td>
                        <Table.Td>{dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Table.Td>
                        <Table.Td>{r.nb_personnes}</Table.Td>
                        <Table.Td>
                          <Badge color={statusColor[r.status]} variant="light">
                            {statusLabel[r.status]}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {r.status === 'pending' && (
                            <Group gap="xs" wrap="nowrap">
                              <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => handleApprove(r.id)}>
                                Valider
                              </Button>
                              <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => openRescheduleModal(r)}>
                                Replanifier
                              </Button>
                              <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => handleReject(r.id)}>
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
              {requests.filter((r) => r.status === 'pending').map((r) => (
                <RequestCard key={r.id} request={r}
                  onApprove={handleApprove} onReject={handleReject} onReschedule={openRescheduleModal}
                />
              ))}
            </SimpleGrid>
          </div>
        </>
      )}

      <Modal opened={opened} onClose={close} title="Proposer une nouvelle date" size="sm"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <TextInput label="Employé"
          value={`${selectedRequest?.Employee?.prenom || ''} ${selectedRequest?.Employee?.nom || ''}`}
          disabled mb="sm"
        />
        <TextInput label="Destination" value={selectedRequest?.destination || ''} disabled mb="sm" />
        <DateTimePicker label="Nouvelle date proposée" value={newDate} onChange={setNewDate}
          minDate={new Date()} mb="md"
        />
        <Button color="brand" fullWidth onClick={handleReschedule}>
          Envoyer la proposition
        </Button>
      </Modal>

      <style>{`
        .page-content {  }
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

export default ValidateRequests;
