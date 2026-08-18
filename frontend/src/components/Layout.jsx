import { useMemo, useState } from 'react';
import { AppShell, NavLink, Stack, Text, Avatar, Divider, Group, ScrollArea, Tooltip, UnstyledButton } from '@mantine/core';
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
  IconChevronsLeft,
  IconChevronsRight,
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
  const [collapsed, setCollapsed] = useState(false);
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

  const navbarWidth = collapsed ? 72 : 260;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: navbarWidth, breakpoint: 'sm', collapsed: { mobile: !opened } }}
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
          transition: 'width 0.2s ease',
        }}
      >
        <Group justify={collapsed ? 'center' : 'space-between'} mb="xs" wrap="nowrap">
          {!collapsed && <Divider style={{ flex: 1 }} />}
          <Tooltip label={collapsed ? 'Développer' : 'Rétrécir'} position="right" withArrow>
            <UnstyledButton
              onClick={() => setCollapsed((c) => !c)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                borderRadius: 6,
                transition: 'background 0.15s ease',
              }}
              className="collapse-btn"
            >
              {collapsed ? <IconChevronsRight size={16} /> : <IconChevronsLeft size={16} />}
            </UnstyledButton>
          </Tooltip>
        </Group>

        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            {navItems.map((item) => {
              const active = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

              const navLink = (
                <NavLink
                  key={item.path}
                  label={collapsed ? undefined : item.label}
                  leftSection={<item.icon size={18} />}
                  active={active}
                  color="brand"
                  variant={active ? 'light' : 'subtle'}
                  onClick={() => {
                    navigate(item.path);
                    if (opened) toggle();
                  }}
                  style={{ borderRadius: 8, justifyContent: collapsed ? 'center' : undefined }}
                  p={collapsed ? 'sm' : undefined}
                />
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.path} label={item.label} position="right" withArrow>
                    {navLink}
                  </Tooltip>
                );
              }
              return navLink;
            })}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="xs" />
          {!collapsed && (
            <Group gap="xs" px="sm" py="xs">
              <IconCaravan size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">ADES Logistique</Text>
            </Group>
          )}
          {collapsed && (
            <Group justify="center" py="xs">
              <IconCaravan size={14} color="var(--mantine-color-dimmed)" />
            </Group>
          )}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: '#f5f7f5', minHeight: '100vh' }}>
        {children}
      </AppShell.Main>

      <style>{`
        .collapse-btn:hover {
          background-color: var(--mantine-color-gray-1);
        }
      `}</style>
    </AppShell>
  );
}

export default Layout;
