import { useEffect, useState } from 'react';
import {
  Paper, Badge, Center, Text, Group, Button, Card,
  SimpleGrid, Stack, Modal, TextInput, Textarea, NumberInput, SegmentedControl, Pagination, Grid, ScrollArea,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { IconCheck, IconX, IconTrash, IconInbox, IconEdit, IconSend, IconBan } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import EmptyState from '../../components/EmptyState';
import MotifCell from '../../components/MotifCell';
import RequestDetailModal from '../../components/RequestDetailModal';
import { requestStatusLabel as statusLabel, requestStatusColor as statusColor, vehicleDisplayName } from '../../utils/labels';

function RequestCard({ request, onRespond, onCancel, onEdit, onDetail, onDelete }) {
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
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Text fw={600} size="md" style={{ minWidth: 0, wordBreak: 'break-word' }}>{request.destination}</Text>
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
            <Text span size="sm">{vehicleDisplayName(request.Vehicle)}</Text>
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
          <Button size="xs" variant="outline" color="gray" leftSection={<IconBan size={14} />}
            onClick={onCancel}
          >Annuler</Button>
        )}
        <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />}
          onClick={onDelete}
        >Supprimer</Button>
      </Group>
    </Card>
  );
}

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const paginatedRequests = requests.slice((page - 1) * pageSize, page * pageSize);

  // Si la page courante dépasse la dernière page (dernier élément supprimé), revenir en arrière
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(requests.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [requests, page]);

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await requestService.remove(deleteTarget.id);
      notifySuccess('Demande supprimée');
      setDeleteTarget(null);
      fetchRequests();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally { setDeleting(false); }
  };

  const [detailRequest, setDetailRequest] = useState(null);
  const [detailOpened, setDetailOpened] = useState(false);
  const openDetail = (r) => { setDetailRequest(r); setDetailOpened(true); };

  const canCancel = (r) => ['pending', 'approved'].includes(r.status);

  const isMobile = useMediaQuery('(max-width: 767px)');

  const allColumns = [
    { accessor: 'destination', title: 'Destination', sortable: true },
    { accessor: 'motif', title: 'Motif', render: (r) => <MotifCell motif={r.motif} maxWidth={140} /> },
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
          <Text size="sm">{vehicleDisplayName(r.Vehicle)}</Text>
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
        <Group gap="xs" wrap="wrap" onClick={(e) => e.stopPropagation()}>
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
            <Button size="xs" variant="outline" color="gray" leftSection={<IconBan size={14} />}
              onClick={() => setCancelTarget(r)}
            >Annuler</Button>
          )}
          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />}
            onClick={() => setDeleteTarget(r)}
          >Supprimer</Button>
        </Group>
      ),
    },
  ];

  // Colonnes secondaires masquées sur mobile (détail visible dans les cartes/détails)
  const columns = isMobile
    ? allColumns.filter((c) => !['motif', 'nb_personnes', 'vehicle'].includes(c.accessor))
    : allColumns;

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Mes demandes" subtitle={`${requests.length} demande${requests.length !== 1 ? 's' : ''}`}>
        <SegmentedControl value={viewMode} onChange={setViewMode}
          data={[
            { label: 'Cartes', value: 'cards' },
            { label: 'Tableau', value: 'table' },
          ]}
          size="xs" color="brand"
        />
      </PageHeader>

      {requests.length === 0 ? (
        <EmptyState icon={IconInbox} message="Aucune demande pour le moment" />
      ) : (
        <>
          {viewMode === 'cards' ? (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {paginatedRequests.map((r) => (
                  <RequestCard key={r.id} request={r} onRespond={(accepted) => { setRespondTarget(r); setRespondAccepted(accepted); }} onCancel={() => setCancelTarget(r)} onEdit={openEdit} onDetail={openDetail} onDelete={() => setDeleteTarget(r)} />
                ))}
              </SimpleGrid>
              {requests.length > pageSize && (
                <Center mt="md">
                  <Pagination total={Math.ceil(requests.length / pageSize)} value={page} onChange={setPage} color="brand" />
                </Center>
              )}
            </>
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
                page={page}
                onPageChange={setPage}
                totalRecords={requests.length}
                recordsPerPage={pageSize}
                paginationSize="sm"
                paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
                onRowClick={({ record }) => openDetail(record)}
              />
            </Paper>
          )}
        </>
      )}

      <RequestDetailModal
        opened={detailOpened}
        onClose={() => setDetailOpened(false)}
        request={detailRequest}
        showEmployee={false}
      />

      <Modal opened={!!editRequest} onClose={() => setEditRequest(null)}
        title="Modifier la demande" size="lg" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
        scrollAreaComponent={ScrollArea.Autosize}>
        {editRequest && (
          <Stack gap="sm">
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput label="Destination" value={editDestination}
                  onChange={(e) => setEditDestination(e.currentTarget.value)} required w="100%" radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <DateTimePicker label="Date souhaitée" value={editDate}
                  onChange={setEditDate} required minDate={new Date()} w="100%" radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput label="Nombre de personnes" value={editNb}
                  onChange={setEditNb} min={1} max={20} required w="100%" radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput label="Statut" value={statusLabel[editRequest.status] || editRequest.status}
                  disabled w="100%" />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea label="Motif" value={editMotif}
                  onChange={(e) => setEditMotif(e.currentTarget.value)} required minRows={2} w="100%" radius="md" />
              </Grid.Col>
            </Grid>
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
          : 'Votre demande sera annulée et la place libérée.'}
        confirmLabel="Oui, annuler"
        variant="danger"
        loading={cancelling}
      />

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer cette demande ?"
        message={deleteTarget?.status === 'approved'
          ? "Cette demande est validée : sa sortie associée sera mise à jour, ou supprimée si elle n'emporte plus personne."
          : 'Cette action est définitive : la demande disparaîtra de votre historique.'}
        confirmLabel="Oui, supprimer"
        variant="danger"
        loading={deleting}
      />

      <style>{`
        .request-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .request-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default MyRequests;
