import { useMemo, useState } from 'react';
import { AppShell, NavLink, Stack, Text, Divider, Group, ScrollArea, Tooltip, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconConfetti,
  IconFileText,
  IconRoute,
  IconCar,
  IconPlus,
  IconCaravan,
  IconUsers,
  IconDatabaseImport,
  IconReportAnalytics,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';

const navConfig = {
  chief: [
    { label: 'Accueil', path: '/', icon: IconConfetti },
    { label: 'Demandes à valider', path: '/valider-demandes', icon: IconFileText },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
    { label: 'Rapports', path: '/rapports', icon: IconReportAnalytics },
  ],
  employee: [
    { label: 'Accueil', path: '/', icon: IconConfetti },
    { label: 'Mes demandes', path: '/mes-demandes', icon: IconFileText },
    { label: 'Nouvelle demande', path: '/nouvelle-demande', icon: IconPlus },
    { label: 'Mes trajets', path: '/mes-trajets', icon: IconRoute },
  ],
  superadmin: [
    { label: 'Accueil', path: '/', icon: IconConfetti },
    { label: 'Gestion utilisateurs', path: '/utilisateurs', icon: IconUsers },
    { label: 'Importation', path: '/importation', icon: IconDatabaseImport },
    { label: 'Demandes à valider', path: '/valider-demandes', icon: IconFileText },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
    { label: 'Rapports', path: '/rapports', icon: IconReportAnalytics },
  ],
};

function Layout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const [collapsed, setCollapsed] = useState(false);
  const [openParents, setOpenParents] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isChief = user?.role === 'logistics_chief' || user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const navItems = useMemo(() => {
    if (isSuperadmin) return navConfig.superadmin;
    return isChief ? navConfig.chief : navConfig.employee;
  }, [isChief, isSuperadmin]);

  const navbarWidth = collapsed ? 72 : 260;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: navbarWidth, breakpoint: 'lg', collapsed: { mobile: !opened } }}
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
              const isActive = item.children
                ? item.children.some((c) => location.pathname.startsWith(c.path))
                : item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);

              const isParentOpen = isActive || openParents[item.label];

              if (item.children) {
                const navLink = (
                  <NavLink
                    key={item.label}
                    label={collapsed ? undefined : item.label}
                    leftSection={<item.icon size={18} />}
                    active={isActive}
                    color="brand"
                    variant={isActive ? 'light' : 'subtle'}
                    opened={collapsed ? undefined : isParentOpen}
                    onClick={() => {
                      if (collapsed) {
                        navigate(item.children[0].path);
                        if (opened) toggle();
                      } else {
                        setOpenParents((prev) => ({ ...prev, [item.label]: !prev[item.label] }));
                      }
                    }}
                    style={{ borderRadius: 8, justifyContent: collapsed ? 'center' : undefined }}
                    p={collapsed ? 'sm' : undefined}
                  >
                    {!collapsed && item.children.map((child) => {
                      const childActive = child.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(child.path);
                      return (
                        <NavLink
                          key={child.path}
                          label={child.label}
                          leftSection={<child.icon size={16} />}
                          active={childActive}
                          color="brand"
                          variant={childActive ? 'light' : 'subtle'}
                          onClick={() => {
                            navigate(child.path);
                            if (opened) toggle();
                          }}
                          style={{ borderRadius: 8 }}
                        />
                      );
                    })}
                  </NavLink>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.label} label={item.label} position="right" withArrow>
                      {navLink}
                    </Tooltip>
                  );
                }
                return navLink;
              }

              const navLink = (
                <NavLink
                  key={item.path}
                  label={collapsed ? undefined : item.label}
                  leftSection={<item.icon size={18} />}
                  active={isActive}
                  color="brand"
                  variant={isActive ? 'light' : 'subtle'}
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
