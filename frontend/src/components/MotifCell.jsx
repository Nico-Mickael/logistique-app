import { Text, Tooltip } from '@mantine/core';

// Affiche un motif tronqué dans les DataTables : le texte complet n'est
// consultable qu'au survol (tooltip), pour éviter que les longs motifs
// étirent les colonnes des tableaux.
export default function MotifCell({ motif, maxWidth = 180 }) {
  if (!motif) return <Text size="sm" c="dimmed">\u2014</Text>;
  return (
    <Tooltip label={motif} multiline w={320} withArrow openDelay={400} withinPortal>
      <Text size="sm" truncate maw={maxWidth} style={{ cursor: 'help' }}>
        {motif}
      </Text>
    </Tooltip>
  );
}