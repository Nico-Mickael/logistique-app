import { useMemo } from 'react';
import { AppShell, NavLink, Stack, Text, Avatar, Divider, Group, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard,
  IconFileText,
  IconRoute,
  IconCar,
  IconPlus,
  IconCaravan,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';

const navConfig = {
  chief: [
    { label: 'Tableau de bord', path: '/', icon: IconLayoutDashboard },
    { label: 'Demandes à valider', path: '/valider-demandes', icon: IconFileText },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
  ],
  employee: [
    { label: 'Tableau de bord', path: '/', icon: IconLayoutDashboard },
    { label: 'Mes demandes', path: '/mes-demandes', icon: IconFileText },
    { label: 'Nouvelle demande', path: '/nouvelle-demande', icon: IconPlus },
  ],
};

function Layout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isChief = user?.role === 'logistics_chief' || user?.role === 'admin';
  const navItems = useMemo(() => (isChief ? navConfig.chief : navConfig.employee), [isChief]);

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
        <AppShell.Section>
          <Group gap="sm" px="sm" py="xs" mb="xs">
            <Avatar color="brand" radius="xl" size="md">
              {initials}
            </Avatar>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Text size="sm" fw={600} truncate>
                {user?.prenom} {user?.nom}
              </Text>
              <Text size="xs" c="dimmed" tt="capitalize">
                {user?.role === 'logistics_chief' ? 'Chef logistique' : user?.role === 'admin' ? 'Administrateur' : 'Employé'}
              </Text>
            </div>
          </Group>
        </AppShell.Section>

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
