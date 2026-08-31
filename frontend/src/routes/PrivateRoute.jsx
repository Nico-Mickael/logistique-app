import { Navigate } from 'react-router-dom';
import { Paper, Title, Text, Button, Center, Stack, Group } from '@mantine/core';
import { IconLock, IconArrowLeft, IconHome } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

function AccessDenied() {
  return (
    <Center h="100vh" style={{ background: 'var(--mantine-color-gray-0)' }}>
      <Paper
        p="xl"
        radius="xl"
        withBorder
        maw={460}
        w="100%"
        mx="md"
        style={{
          background: 'var(--mantine-color-body)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        }}
      >
        <Stack align="center" gap="lg">
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--mantine-color-red-6) 12%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            <IconLock size={44} color="var(--mantine-color-red-6)" style={{ opacity: 0.85 }} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <Text
              fw={800}
              size="80px"
              lh={1}
              style={{
                background: 'linear-gradient(135deg, var(--mantine-color-red-6), color-mix(in srgb, var(--mantine-color-red-6) 60%, #888))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.04em',
              }}
            >
              403
            </Text>
            <Title order={3} mt={4}>Accès refusé</Title>
            <Text c="dimmed" mt={6} size="sm" maw={320} mx="auto">
              Vous n'avez pas les droits nécessaires pour accéder à cette page.
            </Text>
          </div>

          <Group gap="sm" mt="xs">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => window.history.back()}
            >
              Retour
            </Button>
            <Button
              leftSection={<IconHome size={16} />}
              onClick={() => { window.location.href = '/'; }}
            >
              Accueil
            </Button>
          </Group>
        </Stack>
      </Paper>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </Center>
  );
}

function PrivateRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied />;
  }

  return children;
}

export default PrivateRoute;
