import { Fragment } from 'react';
import { Group, Title, Text, Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function ReportBreadcrumb({ active }) {
  const navigate = useNavigate();
  const tabs = [
    { key: 'history', label: 'Historique', path: '/rapports/historique' },
    { key: 'passenger', label: 'Passager', path: '/rapports/passager' },
  ];
  return (
    <Group gap={6} align="center" wrap="wrap">
      <Title
        order={3}
        style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
        onClick={() => navigate('/rapports')}
      >
        Tableau de bord
      </Title>
      {tabs.map((it) => (
        <Fragment key={it.key}>
          <Text c="dimmed" size="xl" style={{ userSelect: 'none' }}>/</Text>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            radius="md"
            px="sm"
            fw={active === it.key ? 700 : 400}
            onClick={() => navigate(it.path)}
          >
            {it.label}
          </Button>
        </Fragment>
      ))}
    </Group>
  );
}