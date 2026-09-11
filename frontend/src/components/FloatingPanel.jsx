import { useState } from 'react';
import { Paper, Badge, Text, Group, ActionIcon, Tooltip, UnstyledButton, ScrollArea } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

function FloatingPanel({ title, badgeCount, color = 'green', children }) {
  const [open, setOpen] = useState(true);

  return open ? (
    <Paper p="md"
      radius="lg"
      withBorder
      className={`floating-panel floating-panel--${color}`}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Text fw={600} size="xs" c={color} truncate>{title}</Text>
          {badgeCount != null && (
            <Badge color={color} variant="light" size="sm">{badgeCount}</Badge>
          )}
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => setOpen(false)}
          aria-label="Réduire"
          style={{ flexShrink: 0 }}
        >
          <IconChevronDown size={14} />
        </ActionIcon>
      </Group>
      <ScrollArea.Autosize mah={240} style={{ width: '100%' }}>
        {children}
      </ScrollArea.Autosize>
    </Paper>
  ) : (
    <Tooltip label={title} position="top" withArrow>
      <UnstyledButton
        className="floating-panel-btn"
        onClick={() => setOpen(true)}
        aria-label={title}
      >
        {badgeCount != null && badgeCount > 0 && (
          <Badge color={color} variant="filled" size="xs" circle className="floating-panel-badge">
            {badgeCount}
          </Badge>
        )}
        <IconChevronUp size={14} />
      </UnstyledButton>
    </Tooltip>
  );
}

export default FloatingPanel;