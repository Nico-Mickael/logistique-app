import { useEffect, useState } from 'react';
import {
  Paper, Title, Badge, Loader, Center, Text, Group, Button, Card,
  SimpleGrid, Stack, Flex, Modal, TextInput, Textarea, NumberInput, SegmentedControl,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { IconCheck, IconX, IconTrash, IconInbox, IconEdit, IconSend } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import { requestStatusLabel as statusLabel, requestStatusColor as statusColor } from '../../utils/labels';

function RequestCard({ request, onRespond, onCancel, onEdit, onDetail }) {
  const canCancel = ['pending', 'approved'].includes(request.status);

  return (
    <Card withBorder radius="lg" p="lg" className="request-card" style={{ cursor: 'pointer' }} onClick={() => onDetail && onDetail(request)}>
      <div className="stat-card-accent" style={{
        background: request.status === 'approved' ? 'var(--mantine-color-brand-6)' :
                     request.status === 'rejected' ? 'var(--mantine-color-red-6)' :
                     request.status === 'cancelled' ? 'var(--mantine-color-gray-5)' :
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
        {request.Vehicle && (
          <Text size="sm">
            <Text span c="dimmed" size="sm">Véhicule: </Text>
            <Text span tt="capitalize" size="sm">{request.Vehicle.type}</Text>
          </Text>
        )}
      </Stack>
      <Group gap="xs" onClick={(e) => e.stopPropagation()}>
        {request.status === 'pending' && (
          <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />}
            onClick={() => onEdit(request)}
          >Modifier</Button>
        )}
        {request.status === 'rescheduled' && (
          <>
            <Button size="xs" color="brand" leftSection={<IconCheck size={14} />}
              onClick={() => onRespond(true)}
            >Accepter</Button>
            <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />}
              onClick={() => onRespond(false)}
            >Refuser</Button>
          </>
        )}
        {canCancel && (
          <Button size="xs" variant="outline" color="gray" leftSection={<IconTrash size={14} />}
            onClick={onCancel}
          >Annuler</Button>
        )}
      </Group>
    </Card>
  );
}

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards');

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

  const [editRequest, setEditRequest] = useState(null);
  const [editDestination, setEditDestination] = useState('');
  const [editMotif, setEditMotif] = useState('');
  const [editDate, setEditDate] = useState(null);
  const [editNb, setEditNb] = useState(1);
  const [saving, setSaving] = useState(false);
  const [respondTarget, setRespondTarget] = useState(null);
  const [respondAccepted, setRespondAccepted] = useState(false);
  const [responding, setResponding] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const openEdit = (r) => {
    setEditRequest(r);
    setEditDestination(r.destination);
    setEditMotif(r.motif);
    setEditDate(new Date(r.date_souhaitee));
    setEditNb(r.nb_personnes);
  };

  const handleEditSave = async () => {
    if (!editDestination || !editMotif || !editDate) {
      notifyError('Veuillez remplir tous les champs');
      return;
    }
    setSaving(true);
    try {
      await requestService.update(editRequest.id, {
        destination: editDestination,
        motif: editMotif,
        date_souhaitee: editDate,
        nb_personnes: editNb,
      });
      notifySuccess('Demande modifiée avec succès');
      setEditRequest(null);
      fetchRequests();
    } catch (err) {
      notifyError(err.response?.data?.message || "Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  const handleRespond = async () => {
    if (!respondTarget) return;
    setResponding(true);
    try {
      await requestService.respondReschedule(respondTarget.id, respondAccepted);
      notifySuccess(respondAccepted ? 'Nouvelle date acceptée' : 'Replanification refusée');
      setRespondTarget(null);
      fetchRequests();
    } catch { notifyError('Erreur lors de la réponse'); }
    finally { setResponding(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await requestService.cancel(cancelTarget.id);
      notifySuccess('Demande annulée');
      setCancelTarget(null);
      fetchRequests();
    } catch { notifyError("Erreur lors de l'annulation"); }
    finally { setCancelling(false); }
  };

  const [detailRequest, setDetailRequest] = useState(null);
  const [detailOpened, setDetailOpened] = useState(false);
  const openDetail = (r) => { setDetailRequest(r); setDetailOpened(true); };

  const canCancel = (r) => ['pending', 'approved'].includes(r.status);

  const columns = [
    { accessor: 'destination', title: 'Destination', sortable: true },
    { accessor: 'motif', title: 'Motif' },
    {
      accessor: 'date_souhaitee', title: 'Date souhaitée', sortable: true,
      render: (r) => dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm'),
    },
    { accessor: 'nb_personnes', title: 'Personnes', textAlign: 'center' },
    {
      accessor: 'vehicle', title: 'Véhicule',
      render: (r) => r.Vehicle ? (
        <Group gap={4}>
          <VehicleIcon type={r.Vehicle.type} size={14} color="var(--mantine-color-dimmed)" />
          <Text size="sm" tt="capitalize">{r.Vehicle.type}</Text>
        </Group>
      ) : '\u2014',
    },
    {
      accessor: 'status', title: 'Statut', sortable: true,
      render: (r) => <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status]}</Badge>,
    },
    {
      accessor: 'actions', title: '',
      render: (r) => (
        <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          {r.status === 'pending' && (
            <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />}
              onClick={() => openEdit(r)}
            >Modifier</Button>
          )}
          {r.status === 'rescheduled' && (
            <>
              <Button size="xs" color="brand" leftSection={<IconCheck size={14} />}
                onClick={() => { setRespondTarget(r); setRespondAccepted(true); }}
              >Accepter</Button>
              <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />}
                onClick={() => { setRespondTarget(r); setRespondAccepted(false); }}
              >Refuser</Button>
            </>
          )}
          {canCancel(r) && (
            <Button size="xs" variant="outline" color="gray" leftSection={<IconTrash size={14} />}
              onClick={() => setCancelTarget(r)}
            >Annuler</Button>
          )}
        </Group>
      ),
    },
  ];

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Mes demandes</Title>
          <Text size="sm" c="dimmed" mt={2}>{requests.length} demande{requests.length !== 1 ? 's' : ''}</Text>
        </div>
        <SegmentedControl value={viewMode} onChange={setViewMode}
          data={[
            { label: 'Cartes', value: 'cards' },
            { label: 'Tableau', value: 'table' },
          ]}
          size="xs" color="brand"
        />
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
          {viewMode === 'cards' ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} onRespond={(accepted) => { setRespondTarget(r); setRespondAccepted(accepted); }} onCancel={() => setCancelTarget(r)} onEdit={openEdit} onDetail={openDetail} />
              ))}
            </SimpleGrid>
          ) : (
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <DataTable
                withTableBorder
                borderRadius="md"
                highlightOnHover
                striped
                verticalSpacing="sm"
                columns={columns}
                records={requests}
                idAccessor="id"
                onRowClick={({ record }) => openDetail(record)}
              />
            </Paper>
          )}
        </>
      )}

      <Modal opened={detailOpened} onClose={() => setDetailOpened(false)} title="Détail de la demande" size="lg" radius="md"
        fullScreen={{ base: true, sm: false }}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {detailRequest && (
          <Stack gap="sm">
            <div><Text size="xs" c="dimmed">Destination</Text><Text fw={500}>{detailRequest.destination}</Text></div>
            <div><Text size="xs" c="dimmed">Motif</Text><Text>{detailRequest.motif}</Text></div>
            <Group grow>
              <div><Text size="xs" c="dimmed">Date souhaitée</Text><Text fw={500}>{dayjs(detailRequest.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Text></div>
              <div><Text size="xs" c="dimmed">Personnes</Text><Text fw={500}>{detailRequest.nb_personnes}</Text></div>
            </Group>
            <Group grow>
              <div><Text size="xs" c="dimmed">Statut</Text><Badge color={statusColor[detailRequest.status] || 'gray'} variant="light">{statusLabel[detailRequest.status] || detailRequest.status}</Badge></div>
              {detailRequest.Vehicle && (
                <div><Text size="xs" c="dimmed">Véhicule</Text><Text fw={500} tt="capitalize">{detailRequest.Vehicle.type} ({detailRequest.Vehicle.capacity} pers.)</Text></div>
              )}
            </Group>
            <Group grow>
              <div><Text size="xs" c="dimmed">Créée le</Text><Text>{dayjs(detailRequest.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
              <div><Text size="xs" c="dimmed">Dernière modification</Text><Text>{dayjs(detailRequest.updatedAt).format('DD/MM/YYYY HH:mm')}</Text></div>
            </Group>
            {detailRequest.Sorties?.length > 0 && detailRequest.Sorties[0]?.returned_at && (
              <div><Text size="xs" c="dimmed">Retourné le</Text><Text>{dayjs(detailRequest.Sorties[0].returned_at).format('DD/MM/YYYY HH:mm')}</Text></div>
            )}
          </Stack>
        )}
      </Modal>

      <Modal opened={!!editRequest} onClose={() => setEditRequest(null)}
        title="Modifier la demande" size="lg" radius="md"
        fullScreen={{ base: true, sm: false }}>
        {editRequest && (
          <Stack gap="sm">
            <TextInput label="Destination" value={editDestination}
              onChange={(e) => setEditDestination(e.currentTarget.value)} required />
            <Textarea label="Motif" value={editMotif}
              onChange={(e) => setEditMotif(e.currentTarget.value)} required minRows={2} />
            <DateTimePicker label="Date souhaitée" value={editDate}
              onChange={setEditDate} required minDate={new Date()} />
            <NumberInput label="Nombre de personnes" value={editNb}
              onChange={setEditNb} min={1} max={20} required />
            <Group justify="end" mt="md">
              <Button variant="default" onClick={() => setEditRequest(null)}>Annuler</Button>
              <Button leftSection={<IconSend size={16} />} onClick={handleEditSave} loading={saving}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <ConfirmModal
        opened={!!respondTarget}
        onClose={() => setRespondTarget(null)}
        onConfirm={handleRespond}
        title={`${respondAccepted ? 'Accepter' : 'Refuser'} la replanification ?`}
        message={respondAccepted ? 'Vous confirmez la nouvelle date proposée.' : 'Votre demande sera annulée.'}
        confirmLabel={respondAccepted ? 'Accepter' : 'Refuser'}
        variant={respondAccepted ? 'question' : 'danger'}
        loading={responding}
      />

      <ConfirmModal
        opened={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Annuler cette demande ?"
        message={cancelTarget?.status === 'approved'
          ? "Cette demande est déjà validée. L'annuler libérera la place sur le véhicule."
          : 'Votre demande sera supprimée et la place libérée.'}
        confirmLabel="Oui, annuler"
        variant="danger"
        loading={cancelling}
      />

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
