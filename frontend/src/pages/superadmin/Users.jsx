import { useEffect, useState } from 'react';
import {
  Paper, Title, Badge, Loader, Center, Text, Group, Button, Modal, TextInput, Select, Flex, Stack,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconPlus, IconInbox, IconEdit, IconTrash, IconUsers as IconUsersIcon } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import api from '../../api/axios';

const roleLabels = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  logistics_chief: 'Chef logistique',
  employee: 'Employé',
};

const roleColors = {
  superadmin: 'red',
  admin: 'orange',
  logistics_chief: 'brand',
  employee: 'gray',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ nom: '', prenom: '', email: '', password: '', department: '', role: 'employee' });

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/employees');
      setUsers(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ nom: '', prenom: '', email: '', password: '', department: '', role: 'employee' });
    open();
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ nom: u.nom, prenom: u.prenom, email: u.email, password: '', department: u.department || '', role: u.role });
    open();
  };

  const handleSave = async () => {
    if (!form.nom || !form.prenom || !form.email) {
      notifications.show({ color: 'red', title: 'Erreur', message: 'Nom, prénom et email sont obligatoires' });
      return;
    }
    if (!editUser && !form.password) {
      notifications.show({ color: 'red', title: 'Erreur', message: 'Mot de passe obligatoire pour un nouvel utilisateur' });
      return;
    }
    setSaving(true);
    try {
      if (editUser) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/employees/${editUser.id}`, payload);
        notifications.show({ color: 'green', title: 'Succès', message: 'Utilisateur modifié' });
      } else {
        await api.post('/employees', form);
        notifications.show({ color: 'green', title: 'Succès', message: 'Utilisateur créé' });
      }
      close();
      fetchUsers();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Erreur', message: err.response?.data?.message || 'Erreur serveur' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Supprimer ${u.prenom} ${u.nom} ?`)) return;
    try {
      await api.delete(`/employees/${u.id}`);
      notifications.show({ color: 'green', title: 'Succès', message: 'Utilisateur supprimé' });
      fetchUsers();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Erreur', message: err.response?.data?.message || 'Erreur serveur' });
    }
  };

  const columns = [
    { accessor: 'nom', title: 'Nom', sortable: true },
    { accessor: 'prenom', title: 'Prénom', sortable: true },
    { accessor: 'email', title: 'Email', sortable: true },
    { accessor: 'department', title: 'Département', sortable: true },
    {
      accessor: 'role', title: 'Rôle', sortable: true,
      render: (u) => <Badge color={roleColors[u.role] || 'gray'} variant="light">{roleLabels[u.role] || u.role}</Badge>,
    },
    {
      accessor: 'actions', title: '',
      render: (u) => (
        <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => openEdit(u)}>Modifier</Button>
          {u.role !== 'superadmin' && (
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDelete(u)}>Supprimer</Button>
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
          <Title order={3}>Gestion des utilisateurs</Title>
          <Text size="sm" c="dimmed" mt={2}>{users.length} utilisateur{users.length !== 1 ? 's' : ''}</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} color="brand" onClick={openCreate}>
          Nouvel utilisateur
        </Button>
      </Flex>

      {users.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconUsersIcon size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucun utilisateur</Text>
            </Flex>
          </Center>
        </Paper>
      ) : (
        <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
          <DataTable
            withTableBorder
            borderRadius="md"
            highlightOnHover
            striped
            verticalSpacing="sm"
            columns={columns}
            records={users}
            idAccessor="id"
            sortable
            paginationSize="sm"
            paginationActiveBackgroundColor="#3FA34A"
          />
        </Paper>
      )}

      <Modal opened={opened} onClose={close} title={editUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} size="md" radius="md"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <Stack gap="sm">
          <TextInput label="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.currentTarget.value })} required />
          <TextInput label="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.currentTarget.value })} required />
          <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} required />
          <TextInput label="Mot de passe" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
            placeholder={editUser ? 'Laisser vide pour conserver' : ''} required={!editUser} />
          <TextInput label="Département" value={form.department} onChange={(e) => setForm({ ...form, department: e.currentTarget.value })} />
          <Select label="Rôle" data={[
            { value: 'employee', label: 'Employé' },
            { value: 'logistics_chief', label: 'Chef logistique' },
            { value: 'admin', label: 'Admin' },
          ]} value={form.role} onChange={(v) => setForm({ ...form, role: v || 'employee' })} required />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={close}>Annuler</Button>
            <Button onClick={handleSave} loading={saving} color="brand">
              {editUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <style>{`
        .page-content { animation: fade-in 0.3s ease-out; }
        .dashboard-panel { animation: panel-in 0.4s ease-out; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panel-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
