import { Navigate } from 'react-router-dom';
import { Paper, Title, Text, Button, Center, Stack } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

function AccessDenied() {
  const { logout } = useAuth();
  return (
    <Center h="100vh">
      <Paper p="xl" radius="lg" withBorder maw={400}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="var(--mantine-color-red-6)" />
          <Title order={3} ta="center">Accès refusé</Title>
          <Text c="dimmed" ta="center">Vous n'avez pas les droits nécessaires pour accéder à cette page.</Text>
          <Button color="brand" onClick={() => { logout(); window.location.href = '/login'; }}>
            Retour à la connexion
          </Button>
        </Stack>
      </Paper>
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