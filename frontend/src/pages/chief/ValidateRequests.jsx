import { useEffect, useState } from 'react';
import { Paper, Title, Table, Badge, Loader, Center, Text, Group, Button, Modal, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconX, IconCalendar } from '@tabler/icons-react';
import Swal from 'sweetalert2';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brand.3', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

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
    } catch (err) {
      notifyError('Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    try {
      await requestService.updateStatus(id, 'approved');
      notifySuccess('Demande validée');
      fetchRequests();
    } catch (err) {
      notifyError('Erreur lors de la validation');
    }
  };

  const handleReject = async (id) => {
    const result = await Swal.fire({
      title: 'Refuser cette demande ?',
      text: 'L’employé sera notifié du refus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, refuser',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#2E7D32',
      cancelButtonColor: '#8C8C8C',
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      await requestService.updateStatus(id, 'rejected');
      notifySuccess('Demande refusée');
      fetchRequests();
    } catch (err) {
      notifyError('Erreur lors du refus');
    }
  };

  const openRescheduleModal = (request) => {
    setSelectedRequest(request);
    setNewDate(null);
    open();
  };

  const handleReschedule = async () => {
    if (!newDate) {
      notifyError('Choisissez une nouvelle date');
      return;
    }
    try {
      await requestService.updateStatus(selectedRequest.id, 'rescheduled', newDate);
      notifySuccess('Proposition de replanification envoyée');
      close();
      fetchRequests();
    } catch (err) {
      notifyError('Erreur lors de la replanification');
    }
  };

  if (loading) {
    return (
      <Center h={200}>
        <Loader color="brand" />
      </Center>
    );
  }

  return (
    <Paper p="lg" radius="md" withBorder>
      <Title order={4} mb="md">Demandes à valider</Title>

      {requests.length === 0 ? (
        <Center h={120}>
          <Text c="dimmed" size="sm">Aucune demande</Text>
        </Center>
      ) : (
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Employé</Table.Th>
              <Table.Th>Destination</Table.Th>
              <Table.Th>Date souhaitée</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requests.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.Employee?.prenom} {r.Employee?.nom}</Table.Td>
                <Table.Td>{r.destination}</Table.Td>
                <Table.Td>{new Date(r.date_souhaitee).toLocaleString('fr-FR')}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor[r.status]} variant="light">
                    {statusLabel[r.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {r.status === 'pending' && (
                    <Group gap="xs">
                      <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => handleApprove(r.id)}>
                        Valider
                      </Button>
                      <Button size="xs" variant="outline" color="brand" leftSection={<IconCalendar size={14} />} onClick={() => openRescheduleModal(r)}>
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
      )}

      <Modal opened={opened} onClose={close} title="Proposer une nouvelle date">
        <TextInput label="Employé" value={`${selectedRequest?.Employee?.prenom || ''} ${selectedRequest?.Employee?.nom || ''}`} disabled mb="sm" />
        <DateTimePicker
          label="Nouvelle date proposée"
          value={newDate}
          onChange={setNewDate}
          minDate={new Date()}
          mb="md"
        />
        <Button color="brand" fullWidth onClick={handleReschedule}>
          Envoyer la proposition
        </Button>
      </Modal>
    </Paper>
  );
}

export default ValidateRequests;