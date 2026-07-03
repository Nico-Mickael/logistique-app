import { AppShell, Group, Burger, NavLink, Stack, Text, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconFileText, IconRoute, IconCar, IconBell, IconLogout } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

function Layout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      footer={{ height: 40 }}
      padding="md"
    >
      <AppShell.Header style={{ background: 'linear-gradient(135deg, #3FA34A 0%, #1C4B1E 100%)' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="white" />
            <Logo height={26} />
          </Group>
          <Group gap="md">
            <Text size="sm" c="white">{user?.prenom} {user?.nom}</Text>
            <IconBell size={19} color="white" style={{ cursor: 'pointer' }} />
            <ActionIcon variant="subtle" color="white" onClick={handleLogout}>
              <IconLogout size={19} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          <NavLink label="Tableau de bord" leftSection={<IconLayoutDashboard size={16} />} active color="brand" variant="light" />
          <NavLink label="Demandes" leftSection={<IconFileText size={16} />} />
          <NavLink label="Sorties" leftSection={<IconRoute size={16} />} />
          <NavLink label="Véhicules" leftSection={<IconCar size={16} />} />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>

      <AppShell.Footer p="xs">
        <Text size="xs" c="dimmed" ta="center">© 2026 ADES — Système de gestion logistique interne</Text>
      </AppShell.Footer>
    </AppShell>
  );
}

export default Layout;