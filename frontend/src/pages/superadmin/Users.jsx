import { useEffect, useState } from 'react';
import {
  Paper, Badge, Center, Text, Group, Button, Modal, TextInput, Select, Stack, Card, SimpleGrid, Pagination, SegmentedControl, Tooltip, FileInput, Alert, ScrollArea,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconPlus, IconEdit, IconTrash, IconUsers as IconUsersIcon, IconSearch, IconUpload, IconDownload, IconFileSpreadsheet, IconInfoCircle } from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import EmptyState from '../../components/EmptyState';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifySuccess, notifyError } from '../../utils/toast';
import { employeeService } from '../../api/employeeService';
import { siteService } from '../../api/siteService';
import { getSiteOverride } from '../../api/axios';
import { accentColor, availabilityStatusLabel, availabilityStatusDot } from '../../utils/labels';
import ConfirmModal from '../../components/ConfirmModal';

const roleLabels = {
  superadmin: 'Superadmin',
  logistics_chief: 'Admin',
  chauffeur: 'Chauffeur',
  employee: 'Employé',
};

const roleColors = {
  superadmin: 'red',
  logistics_chief: 'brand',
  chauffeur: 'teal',
  employee: 'gray',
};

function AvailabilityDot({ status }) {
  const s = status || 'available';
  return (
    <Tooltip label={availabilityStatusLabel[s] || s} withArrow position="top">
      <span
        aria-label={availabilityStatusLabel[s] || s}
        style={{
          width: 9, height: 9, borderRadius: '50%',
          background: availabilityStatusDot[s] || '#9098a3',
          display: 'inline-block', flexShrink: 0,
        }}
      />
    </Tooltip>
  );
}

function UserCard({ u, onEdit, onDelete }) {
  return (
    <Card withBorder radius="lg" p="lg" className="user-card">
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accentColor(roleColors[u.role]),
      }} />
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <AvailabilityDot status={u.availability_status} />
          <Text fw={600} size="md" style={{ minWidth: 0, wordBreak: 'break-word' }}>{u.prenom} {u.nom}</Text>
        </Group>
        <Badge color={roleColors[u.role] || 'gray'} variant="light">{roleLabels[u.role] || u.role}</Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed">Email: </Text>{u.email}</Text>
        {u.department && <Text size="sm"><Text span c="dimmed">Département: </Text>{u.department}</Text>}
        <Text size="sm"><Text span c="dimmed">Site: </Text>{u.Site?.name || '—'}</Text>
      </Stack>
      <Group gap="xs">
        <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => onEdit(u)}>Modifier</Button>
        {u.role !== 'superadmin' && (
          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete(u)}>Supprimer</Button>
        )}
      </Group>
    </Card>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const pageSize = 10;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [form, setForm] = useState({ nom: '', prenom: '', email: '', password: '', department: '', role: 'employee', siteId: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('Ades');
  const [importSiteId, setImportSiteId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    siteService
      .list()
      .then(({ data }) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]));
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await employeeService.list();
      setUsers(data);
    } catch {
      notifyError('Impossible de charger les utilisateurs');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.nom || '').toLowerCase().includes(q) ||
      (u.prenom || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q) ||
      (roleLabels[u.role] || u.role).toLowerCase().includes(q)
    );
  });

  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  // Si la page courante dépasse la dernière page (dernier élément supprimé), revenir en arrière
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredUsers, page]);

  const openCreate = () => {
    setEditUser(null);
    const override = getSiteOverride();
    setForm({ nom: '', prenom: '', email: '', password: '', department: '', role: 'employee', siteId: override != null ? String(override) : '' });
    open();
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ nom: u.nom, prenom: u.prenom, email: u.email, password: '', department: u.department || '', role: u.role, siteId: u.site_id != null ? String(u.site_id) : '' });
    open();
  };

  const handleSave = async () => {
    if (!form.nom || !form.prenom || !form.email) {
      notifyError('Nom, prénom et email sont obligatoires');
      return;
    }
    if (!editUser && !form.password) {
      notifyError('Mot de passe obligatoire pour un nouvel utilisateur');
      return;
    }
    setSaving(true);
    try {
      if (editUser) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        if (!payload.siteId) delete payload.siteId;
        await employeeService.update(editUser.id, payload);
        notifySuccess('Utilisateur modifié');
      } else {
        await employeeService.create({
          ...form,
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          email: form.email.trim(),
          siteId: form.siteId ? Number(form.siteId) : undefined,
        });
        notifySuccess('Utilisateur créé');
      }
      close();
      fetchUsers();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur serveur');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await employeeService.remove(deleteTarget.id);
      notifySuccess('Utilisateur supprimé');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur serveur');
    } finally {
      setDeleting(false);
    }
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportPassword('Ades');
    setImportResult(null);
    const override = getSiteOverride();
    setImportSiteId(override != null ? String(override) : '');
    openImport();
  };

  const closeImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    closeImport();
  };

  const downloadTemplate = () => {
    const header = 'nom,prenom,email,mot de passe,departement,role,site';
    const example = 'Dupont,Jean,jean.dupont@exemple.fr,Ades,Logistique,chauffeur,';
    const blob = new Blob([`\uFEFF${header}\n${example}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-utilisateurs.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) {
      notifyError('Sélectionnez un fichier Excel ou CSV');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('defaultPassword', importPassword || 'Ades');
      if (importSiteId) formData.append('siteId', importSiteId);
      const { data } = await employeeService.importUsers(formData);
      setImportResult(data);
      if (data.imported > 0) {
        notifySuccess(`${data.imported} utilisateur${data.imported !== 1 ? 's' : ''} importé${data.imported !== 1 ? 's' : ''}`);
        fetchUsers();
      } else {
        notifyError('Aucun utilisateur importé');
      }
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    {
      accessor: 'nom', title: 'Nom', sortable: true,
      render: (u) => (
        <Group gap={8} wrap="nowrap">
          <AvailabilityDot status={u.availability_status} />
          <Text size="sm">{u.nom}</Text>
        </Group>
      ),
    },
    { accessor: 'prenom', title: 'Prénom', sortable: true },
    { accessor: 'email', title: 'Email', sortable: true },
    { accessor: 'department', title: 'Département', sortable: true },
    {
      accessor: 'role', title: 'Rôle', sortable: true,
      render: (u) => <Badge color={roleColors[u.role] || 'gray'} variant="light">{roleLabels[u.role] || u.role}</Badge>,
    },
    {
      accessor: 'Site.name', title: 'Site', sortable: false,
      render: (u) => (u.Site?.name ? (
        <Badge color="teal" variant="light">{u.Site.name}</Badge>
      ) : (
        <Text size="sm" c="dimmed">—</Text>
      )),
    },
    {
      accessor: 'actions', title: '',
      render: (u) => (
        <Group gap="xs" wrap="wrap" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => openEdit(u)}>Modifier</Button>
          {u.role !== 'superadmin' && (
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(u)}>Supprimer</Button>
          )}
        </Group>
      ),
    },
  ].filter((c) => !(isMobile && c.accessor === 'department'));

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Gestion des utilisateurs" subtitle={`${filteredUsers.length} utilisateur${filteredUsers.length !== 1 ? 's' : ''}`}>
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
          <Button variant="subtle" color="gray" leftSection={<IconUpload size={16} />} onClick={openImportModal}>
            Importer
          </Button>
          {users.length > 0 && (
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
            Nouvel utilisateur
          </Button>
        </Group>
      </PageHeader>

      {users.length === 0 ? (
        <EmptyState icon={IconUsersIcon} message="Aucun utilisateur" />
      ) : filteredUsers.length === 0 ? (
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
                records={filteredUsers}
                idAccessor="id"
                sortable
                page={page}
                onPageChange={setPage}
                totalRecords={filteredUsers.length}
                recordsPerPage={pageSize}
                paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
              />
            </Paper>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {paginatedUsers.map((u) => (
                  <UserCard key={u.id} u={u} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </SimpleGrid>
              <Center mt="md">
                <Pagination total={Math.ceil(filteredUsers.length / pageSize)} value={page} onChange={setPage} color="brand" />
              </Center>
            </>
          )}
        </>
      )}

      <Modal opened={opened} onClose={close} title={editUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Nom" w="100%" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.currentTarget.value })} required radius="md" autoComplete="off" />
            <TextInput label="Prénom" w="100%" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.currentTarget.value })} required radius="md" autoComplete="off" />
            <TextInput label="Email" w="100%" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} required radius="md" autoComplete="off" />
            <TextInput label="Mot de passe" w="100%" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
              placeholder={editUser ? 'Laisser vide pour conserver' : ''} required={!editUser} radius="md" autoComplete="new-password" />
            <TextInput label="Département" w="100%" value={form.department} onChange={(e) => setForm({ ...form, department: e.currentTarget.value })} radius="md" autoComplete="off" />
            <Select label="Site" w="100%" data={[
              ...sites.map((s) => ({ value: String(s.id), label: s.name })),
            ]} value={form.siteId} onChange={(v) => setForm({ ...form, siteId: v || '' })} radius="md"
              placeholder="Site" searchable clearable />
            <Select label="Rôle" w="100%" data={[
              { value: 'employee', label: 'Employé' },
              { value: 'chauffeur', label: 'Chauffeur' },
              { value: 'logistics_chief', label: 'Admin' },
              { value: 'superadmin', label: 'Superadmin' },
            ]} value={form.role} onChange={(v) => setForm({ ...form, role: v || 'employee' })} required radius="md" />
          </SimpleGrid>
          <Group justify="end" mt="md">
            <Button variant="default" onClick={close} radius="md">Annuler</Button>
            <Button onClick={handleSave} loading={saving} color="brand" radius="md">
              {editUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={importOpened} onClose={closeImportModal} title="Importer des utilisateurs" size="lg" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />}>
            Les colonnes sont reconnues automatiquement (accents, majuscules et espaces ignorés) :
            <b> nom, prénom, email, mot de passe, département, rôle, site</b>.
            Seuls <b>nom, prénom et email</b> sont obligatoires.
          </Alert>

          <Button variant="default" leftSection={<IconDownload size={16} />} onClick={downloadTemplate}>
            Télécharger le modèle
          </Button>

          <FileInput
            label="Fichier Excel / CSV"
            placeholder="Choisir un fichier (.xlsx, .xls, .csv)"
            accept=".xlsx,.xls,.csv"
            leftSection={<IconFileSpreadsheet size={16} />}
            value={importFile}
            onChange={setImportFile}
            radius="md"
            clearable
          />

          <TextInput
            label="Mot de passe par défaut"
            description="Attribué aux lignes sans colonne « mot de passe » (min. 4 caractères)"
            value={importPassword}
            onChange={(e) => setImportPassword(e.currentTarget.value)}
            radius="md"
            autoComplete="off"
          />

          {sites.length > 0 && (
            <Select
              label="Site par défaut"
              description="Utilisé si la ligne ne précise pas de site"
              data={sites.map((s) => ({ value: String(s.id), label: s.name }))}
              value={importSiteId}
              onChange={(v) => setImportSiteId(v || '')}
              placeholder="Site par défaut"
              radius="md"
              searchable
              clearable
            />
          )}

          {importResult && (
            <Alert color={importResult.failed > 0 ? 'yellow' : 'green'} variant="light">
              <Text size="sm" fw={600}>
                {importResult.imported} importé{importResult.imported !== 1 ? 's' : ''} sur {importResult.total} ligne{importResult.total !== 1 ? 's' : ''}
                {importResult.failed > 0 ? ` — ${importResult.failed} en erreur` : ''}
              </Text>
              {importResult.errors?.length > 0 && (
                <ScrollArea.Autosize mah={160} mt="xs">
                  <Stack gap={2}>
                    {importResult.errors.map((e, i) => (
                      <Text key={i} size="xs" c="dimmed">
                        Ligne {e.row}{e.email ? ` (${e.email})` : ''} : {e.message}
                      </Text>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              )}
            </Alert>
          )}

          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeImportModal} radius="md">Fermer</Button>
            <Button onClick={handleImport} loading={importing} color="brand" radius="md" leftSection={<IconUpload size={16} />} disabled={!importFile}>
              Importer
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Supprimer ${deleteTarget?.prenom} ${deleteTarget?.nom} ?`}
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
      />

      <style>{`
        .page-content { animation: fade-in 0.3s ease-out; }
        .user-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
      `}</style>
    </div>
  );
}
