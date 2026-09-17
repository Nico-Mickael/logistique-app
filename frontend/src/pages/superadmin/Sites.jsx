import { useEffect, useState } from 'react';
import {
  Paper, Badge, Center, Text, Group, Button, Modal, TextInput, Select, Stack, Card, SimpleGrid, Pagination, SegmentedControl,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconPlus, IconEdit, IconTrash, IconBuilding, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import EmptyState from '../../components/EmptyState';
import { notifySuccess, notifyError } from '../../utils/toast';
import { siteService } from '../../api/siteService';
import { accentColor } from '../../utils/labels';
import ConfirmModal from '../../components/ConfirmModal';

function SiteCard({ s, onEdit, onDelete }) {
  return (
    <Card withBorder radius="lg" p="lg" className="site-card">
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accentColor(s.status === 'active' ? 'green' : 'gray'),
      }} />
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Group gap="xs" wrap="nowrap">
          <IconBuilding size={18} color="var(--mantine-color-brand-6)" />
          <Text fw={600} size="md" style={{ minWidth: 0, wordBreak: 'break-word' }}>{s.name}</Text>
        </Group>
        <Badge color={s.status === 'active' ? 'green' : 'gray'} variant="light">
          {s.status === 'active' ? 'Actif' : 'Inactif'}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed">Code: </Text>{s.code}</Text>
        {s.city && <Text size="sm"><Text span c="dimmed">Ville: </Text>{s.city}</Text>}
        {s.address && <Text size="sm"><Text span c="dimmed">Adresse: </Text>{s.address}</Text>}
      </Stack>
      <Group gap="xs">
        <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => onEdit(s)}>Modifier</Button>
        <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete(s)}>Supprimer</Button>
      </Group>
    </Card>
  );
}

const emptyForm = { name: '', code: '', city: '', address: '', status: 'active' };

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editSite, setEditSite] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const pageSize = 10;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSites = async () => {
    try {
      const { data } = await siteService.list({ all: 1 });
      setSites(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Impossible de charger les sites');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSites(); }, []);

  const filteredSites = sites.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.status === 'active' ? 'actif' : 'inactif').includes(q)
    );
  });

  const paginatedSites = filteredSites.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredSites.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredSites, page]);

  const openCreate = () => {
    setEditSite(null);
    setForm(emptyForm);
    open();
  };

  const openEdit = (s) => {
    setEditSite(s);
    setForm({ name: s.name, code: s.code, city: s.city || '', address: s.address || '', status: s.status });
    open();
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      notifyError('Nom et code sont obligatoires');
      return;
    }
    setSaving(true);
    try {
      if (editSite) {
        await siteService.update(editSite.id, form);
        notifySuccess('Site modifié');
      } else {
        await siteService.create(form);
        notifySuccess('Site créé');
      }
      close();
      fetchSites();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur serveur');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await siteService.remove(deleteTarget.id);
      notifySuccess(data?.message || 'Site supprimé');
      setDeleteTarget(null);
      fetchSites();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur serveur');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { accessor: 'code', title: 'Code', sortable: true },
    { accessor: 'name', title: 'Nom', sortable: true },
    { accessor: 'city', title: 'Ville', sortable: true },
    { accessor: 'address', title: 'Adresse' },
    {
      accessor: 'status', title: 'Statut', sortable: true,
      render: (s) => (
        <Badge color={s.status === 'active' ? 'green' : 'gray'} variant="light">
          {s.status === 'active' ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      accessor: 'actions', title: '',
      render: (s) => (
        <Group gap="xs" wrap="wrap" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => openEdit(s)}>Modifier</Button>
          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(s)}>Supprimer</Button>
        </Group>
      ),
    },
  ].filter((c) => !(isMobile && c.accessor === 'address'));

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Gestion des sites" subtitle={`${filteredSites.length} site${filteredSites.length !== 1 ? 's' : ''}`}>
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            data={[
              { label: 'Cartes', value: 'cards' },
              { label: 'Tableau', value: 'table' },
            ]}
            size="xs"
            color="brand"
          />
          {sites.length > 0 && (
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
              radius="md"
              w={{ base: '100%', sm: 280 }}
            />
          )}
          <Button leftSection={<IconPlus size={16} />} color="brand" onClick={openCreate}>
            Nouveau site
          </Button>
        </Group>
      </PageHeader>

      {sites.length === 0 ? (
        <EmptyState icon={IconBuilding} message="Aucun site" />
      ) : filteredSites.length === 0 ? (
        <EmptyState icon={IconSearch} message={`Aucun résultat pour "${search}"`} />
      ) : (
        <>
          {viewMode === 'table' ? (
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <DataTable
                withTableBorder
                borderRadius="md"
                highlightOnHover
                striped
                verticalSpacing="sm"
                columns={columns}
                records={filteredSites}
                idAccessor="id"
                sortable
                page={page}
                onPageChange={setPage}
                totalRecords={filteredSites.length}
                recordsPerPage={pageSize}
                paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
              />
            </Paper>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {paginatedSites.map((s) => (
                  <SiteCard key={s.id} s={s} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </SimpleGrid>
              <Center mt="md">
                <Pagination total={Math.ceil(filteredSites.length / pageSize)} value={page} onChange={setPage} color="brand" />
              </Center>
            </>
          )}
        </>
      )}

      <Modal opened={opened} onClose={close} title={editSite ? `Modifier le site ${editSite.name}` : 'Nouveau site'} size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Nom" w="100%" value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} required radius="md" autoComplete="off" />
            <TextInput label="Code" w="100%" value={form.code} onChange={(e) => setForm({ ...form, code: e.currentTarget.value })}
              required radius="md" autoComplete="off" />
            <TextInput label="Ville" w="100%" value={form.city} onChange={(e) => setForm({ ...form, city: e.currentTarget.value })} radius="md" autoComplete="off" />
            <TextInput label="Adresse" w="100%" value={form.address} onChange={(e) => setForm({ ...form, address: e.currentTarget.value })} radius="md" autoComplete="off" />
            <Select label="Statut" w="100%" data={[
              { value: 'active', label: 'Actif' },
              { value: 'inactive', label: 'Inactif' },
            ]} value={form.status} onChange={(v) => setForm({ ...form, status: v || 'active' })} radius="md" />
          </SimpleGrid>
          <Group justify="end" mt="md">
            <Button variant="default" onClick={close} radius="md">Annuler</Button>
            <Button onClick={handleSave} loading={saving} color="brand" radius="md">
              {editSite ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Supprimer le site ${deleteTarget?.name} ?`}
        message="S'il contient des données (utilisateurs, véhicules, demandes ou sorties), il sera archivé (passe en « Inactif », masqué des sélecteurs) et son historique sera conservé. Sinon il sera définitivement supprimé."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
      />

      <style>{`
        .page-content { animation: fade-in 0.3s ease-out; }
        .site-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
      `}</style>
    </div>
  );
}