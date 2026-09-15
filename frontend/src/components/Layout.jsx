import { useMemo, useState } from 'react';
import {
  AppShell, NavLink, Stack, Divider, Group, ScrollArea, Tooltip, Badge,
  UnstyledButton, ActionIcon, useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconHome,
  IconFileText,
  IconRoute,
  IconCar,
  IconPlus,
  IconUsers,
  IconReportAnalytics,
  IconChevronsLeft,
  IconChevronsRight,
  IconMoon,
  IconSun,
  IconDeviceDesktop,
  IconBuilding,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from './Header';
import Logo from './Logo';

const navConfig = {
  chief: [
    { label: 'Accueil', path: '/', icon: IconHome },
    { label: 'Tableau de bord', path: '/rapports', icon: IconReportAnalytics, exact: true },
    { label: 'Demandes', path: '/valider-demandes', icon: IconFileText },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
    { label: 'Sessions', path: '/sessions', icon: IconDeviceDesktop },
  ],
  employee: [
    { label: 'Accueil', path: '/', icon: IconHome },
    { label: 'Mes demandes', path: '/mes-demandes', icon: IconFileText },
    { label: 'Nouvelle demande', path: '/nouvelle-demande', icon: IconPlus },
    { label: 'Mes trajets', path: '/mes-trajets', icon: IconRoute },
    { label: 'Sessions', path: '/sessions', icon: IconDeviceDesktop },
    { label: 'Mes rapports', path: '/mes-rapports', icon: IconReportAnalytics },
  ],
  chauffeur: [
    { label: 'Accueil', path: '/', icon: IconHome },
    { label: 'Mes sorties', path: '/mes-sorties', icon: IconRoute },
    { label: 'Mes trajets', path: '/mes-trajets', icon: IconCar },
    { label: 'Sessions', path: '/sessions', icon: IconDeviceDesktop },
    { label: 'Mes rapports', path: '/mes-rapports', icon: IconReportAnalytics },
  ],
  superadmin: [
    { label: 'Accueil', path: '/', icon: IconHome },
    { label: 'Tableau de bord', path: '/rapports', icon: IconReportAnalytics, exact: true },
    { label: 'Demandes', path: '/valider-demandes', icon: IconFileText },
    { label: 'Sorties', path: '/sorties', icon: IconRoute },
    { label: 'Utilisateurs', path: '/utilisateurs', icon: IconUsers },
    { label: 'Sites', path: '/sites', icon: IconBuilding },
    { label: 'Véhicules', path: '/vehicules', icon: IconCar },
    { label: 'Sessions', path: '/sessions', icon: IconDeviceDesktop },
  ],
};

function Layout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const { badgeCounts } = useSocket();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();

  const isChief = user?.role === 'logistics_chief' || user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const isChauffeur = user?.role === 'chauffeur';
  const navItems = useMemo(() => {
    if (isSuperadmin) return navConfig.superadmin;
    if (isChauffeur) return navConfig.chauffeur;
    return isChief ? navConfig.chief : navConfig.employee;
  }, [isChief, isSuperadmin, isChauffeur]);

  const navbarWidth = collapsed ? 72 : 260;

  // Badge rouge "actions à traiter" sur Demandes / Sorties (chef + superadmin).
  // Masqué si 0 ou en mode rétracté (largeur insuffisante).
  const badgeFor = (label) => {
    if (collapsed) return undefined;
    if (label === 'Demandes' && badgeCounts.requests > 0) {
      return <Badge size="xs" radius="xl" color="red" variant="filled">{badgeCounts.requests}</Badge>;
    }
    if (label === 'Sorties' && badgeCounts.sorties > 0) {
      return <Badge size="xs" radius="xl" color="red" variant="filled">{badgeCounts.sorties}</Badge>;
    }
    return undefined;
  };

  return (
    <AppShell
      layout="alt"
      header={{ height: 56 }}
      navbar={{ width: navbarWidth, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding={{ base: 'sm', sm: 'md', lg: 'lg' }}
    >
      <AppShell.Header style={{ border: 'none' }}>
        <Header opened={opened} onToggle={toggle} />
      </AppShell.Header>

      <AppShell.Navbar
        p="sm"
        style={{
          background: 'var(--app-sidebar-bg)',
          borderRight: '1px solid var(--app-sidebar-border)',
          transition: 'width 0.2s ease',
        }}
      >
        <div className={`sidebar-logo ${collapsed ? 'is-collapsed' : ''}`}>
          <div className="sidebar-logo-badge">
            <Logo height={30} />
          </div>
        </div>

        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2} className={collapsed ? 'nav-collapsed' : ''}>
            {navItems.map((item) => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);

              const navLink = (
                <NavLink
                  key={item.path}
                  label={collapsed ? undefined : item.label}
                  leftSection={<item.icon size={18} />}
                  rightSection={badgeFor(item.label)}
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
          <Divider mb="xs" color={dark ? 'dark.4' : 'gray.2'} />
          <Group justify="center" px="sm" py="xs" wrap="nowrap">
            <Tooltip label={dark ? 'Mode clair' : 'Mode sombre'} position="right" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => toggleColorScheme()}
                aria-label="Basculer le thème"
              >
                {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
        {children}
      </AppShell.Main>

      <Tooltip label={collapsed ? 'Développer' : 'Rétrécir'} position="bottom" withArrow>
        <UnstyledButton
          onClick={() => setCollapsed((c) => !c)}
          className="collapse-btn-corner"
          style={{ left: collapsed ? 59 : 247 }}
          aria-label="Réduire le menu"
        >
          {collapsed ? <IconChevronsRight size={15} /> : <IconChevronsLeft size={15} />}
        </UnstyledButton>
      </Tooltip>

      <style>{`
        .sidebar-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 0 12px;
        }
        .sidebar-logo-badge {
          background: light-dark(#fff, #2c2e33);
          border-radius: 8px;
          padding: 4px 10px;
          display: inline-flex;
          align-items: center;
        }
        .sidebar-logo img {
          transition: transform 0.25s ease;
          transform-origin: center center;
        }
        .sidebar-logo.is-collapsed img {
          transform: scale(0.55);
        }
        .nav-collapsed .mantine-NavLink-root {
          justify-content: center;
          padding-inline: 0;
        }
        .nav-collapsed .mantine-NavLink-section {
          margin-inline: auto;
        }
        .nav-collapsed .mantine-NavLink-label {
          display: none;
        }
        .collapse-btn-corner {
          position: fixed;
          top: 43px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--mantine-color-body);
          border: 1px solid var(--mantine-color-default-border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 300;
          transition: left 0.2s ease, background 0.15s ease, transform 0.15s ease;
        }
        .collapse-btn-corner:hover {
          background: light-dark(#f1f3f5, #2C2E33);
          transform: scale(1.08);
        }
        @media (max-width: 992px) {
          .collapse-btn-corner { display: none; }
        }
      `}</style>
    </AppShell>
  );
}

export default Layout;
