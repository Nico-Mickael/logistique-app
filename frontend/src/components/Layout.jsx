import { useMemo } from 'react';
import { AppShell, NavLink, Stack, Text, Avatar, Divider, Group, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard,
  IconFileText,
  IconRoute,
  IconCar,
  IconPlus,
  IconCalendarEvent,
  IconCaravan,
  IconUsers,
  IconDatabaseImport,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';

const navConfig = {
  chief: [
    { label: 'Tableau de bord', path: '/', icon: IconLayoutDashboard },
    { label: 'Demandes à valider', path: '/valider-demandes', icon: IconFileText },
    { label: 'Créer une sortie', path: '/creer-sortie', icon: IconPlus },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Planning', path: '/planning', icon: IconCalendarEvent },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
  ],
  employee: [
    { label: 'Tableau de bord', path: '/', icon: IconLayoutDashboard },
    { label: 'Mes demandes', path: '/mes-demandes', icon: IconFileText },
    { label: 'Nouvelle demande', path: '/nouvelle-demande', icon: IconPlus },
    { label: 'Mes trajets', path: '/mes-trajets', icon: IconRoute },
  ],
  superadmin: [
    { label: 'Tableau de bord', path: '/', icon: IconLayoutDashboard },
    { label: 'Gestion utilisateurs', path: '/utilisateurs', icon: IconUsers },
    { label: 'Importation', path: '/importation', icon: IconDatabaseImport },
    { label: 'Demandes à valider', path: '/valider-demandes', icon: IconFileText },
    { label: 'Créer une sortie', path: '/creer-sortie', icon: IconPlus },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Planning', path: '/planning', icon: IconCalendarEvent },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
  ],
};

function Layout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isChief = user?.role === 'logistics_chief' || user?.role === 'admin';
  const isSuperadmin = user?.role === 'superadmin';
  const navItems = useMemo(() => {
    if (isSuperadmin) return navConfig.superadmin;
    return isChief ? navConfig.chief : navConfig.employee;
  }, [isChief, isSuperadmin]);

  const initials = useMemo(() => {
    if (!user) return '?';
    return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase();
  }, [user]);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={{ base: 'sm', sm: 'md', lg: 'lg' }}
    >
      <AppShell.Header style={{ border: 'none' }}>
        <Header opened={opened} onToggle={toggle} />
      </AppShell.Header>

      <AppShell.Navbar
        p="sm"
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
      >

        <Divider mb="xs" />

        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            {navItems.map((item) => {
              const active = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  active={active}
                  color="brand"
                  variant={active ? 'light' : 'subtle'}
                  onClick={() => {
                    navigate(item.path);
                    if (opened) toggle();
                  }}
                  style={{ borderRadius: 8 }}
                />
              );
            })}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="xs" />
          <Group gap="xs" px="sm" py="xs">
            <IconCaravan size={14} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">ADES Logistique</Text>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: '#f5f7f5', minHeight: '100vh' }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}

export default Layout;
