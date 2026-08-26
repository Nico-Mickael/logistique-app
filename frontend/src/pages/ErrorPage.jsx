import { useRouteError, useNavigate } from 'react-router-dom';
import { Paper, Title, Text, Button, Center, Stack, Group } from '@mantine/core';
import {
  IconTruck, IconHome, IconArrowLeft,
} from '@tabler/icons-react';

const errorConfig = {
  404: {
    code: '404',
    title: 'Page introuvable',
    message: "La route que vous cherchez n'existe pas ou a été déplacée.",
    icon: IconTruck,
    color: 'var(--mantine-color-yellow-6)',
  },
  403: {
    code: '403',
    title: 'Accès refusé',
    message: "Vous n'avez pas les droits nécessaires pour accéder à cette page.",
    icon: IconTruck,
    color: 'var(--mantine-color-red-6)',
  },
  500: {
    code: '500',
    title: 'Erreur serveur',
    message: "Quelque chose s'est mal passé côté serveur. Réessayez plus tard.",
    icon: IconTruck,
    color: 'var(--mantine-color-orange-6)',
  },
  default: {
    code: '!',
    title: 'Une erreur est survenue',
    message: "Une erreur inattendue s'est produite.",
    icon: IconTruck,
    color: 'var(--mantine-color-gray-6)',
  },
};

export default function ErrorPage({ code: propCode }) {
  const error = useRouteError();
  const navigate = useNavigate();

  let code = propCode;
  if (!code && error) {
    if (error.status) code = error.status;
    else if (error.response?.status) code = error.response.status;
  }
  const config = errorConfig[code] || errorConfig.default;
  const Icon = config.icon;

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
              background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            <Icon size={44} color={config.color} style={{ opacity: 0.85 }} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <Text
              fw={800}
              size="80px"
              lh={1}
              style={{
                background: `linear-gradient(135deg, ${config.color}, color-mix(in srgb, ${config.color} 60%, #888))`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.04em',
              }}
            >
              {config.code}
            </Text>
            <Title order={3} mt={4}>
              {config.title}
            </Title>
            <Text c="dimmed" mt={6} size="sm" maw={320} mx="auto">
              {config.message}
            </Text>
          </div>

          <Group gap="sm" mt="xs">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
            >
              Retour
            </Button>
            <Button
              leftSection={<IconHome size={16} />}
              onClick={() => navigate('/')}
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
