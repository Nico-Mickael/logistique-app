import { Group, Paper, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import Messages from '../pages/Messages';

function MessengerPanel({ onClose, collapsed }) {
  return (
    <Paper
      className="messenger-floating-panel"
      radius="lg"
      withBorder
      shadow="xl"
      style={{ '--messenger-left': collapsed ? '72px' : '260px' }}
    >
      <Group justify="space-between" px="md" py="sm" wrap="nowrap" className="messenger-floating-header">
        <Text fw={600} size="sm">Messagerie</Text>
        <Tooltip label="Fermer" position="bottom" withArrow>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose} aria-label="Fermer la messagerie">
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <div className="messenger-floating-body">
        <Messages embedded />
      </div>
    </Paper>
  );
}

export default MessengerPanel;