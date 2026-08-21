import { Title, Text, Flex, Group, Divider } from '@mantine/core';
import {
  IconConfetti, IconTrophy, IconFlag, IconRoute, IconUsers,
  IconRocket, IconShieldCheck,
} from '@tabler/icons-react';

const milestones = [
  {
    year: '2001',
    icon: IconFlag,
    title: 'Les débuts',
    text: 'Création de l’ADES : une équipe fondatrice, une première flotte et les premiers trajets.',
  },
  {
    year: '2006',
    icon: IconRoute,
    title: 'Première expansion',
    text: 'La flotte s’agrandit pour desservir davantage de destinations à travers le pays.',
  },
  {
    year: '2011',
    icon: IconUsers,
    title: 'Montée en puissance',
    text: 'Une organisation structurée : planification, maintenance et suivi renforcés.',
  },
  {
    year: '2016',
    icon: IconRocket,
    title: 'Cap sur la modernité',
    text: 'Renouvellement de la flotte et premières digitalisations des processus internes.',
  },
  {
    year: '2021',
    icon: IconShieldCheck,
    title: 'Résilience',
    text: 'L’ADES s’adapte et continue d’assurer les déplacements essentiels dans toutes les circonstances.',
  },
  {
    year: '2026',
    icon: IconConfetti,
    title: '25 ans !',
    text: 'Une nouvelle plateforme logistique pour écrire ensemble le prochain chapitre.',
  },
];

export default function Accueil() {
  return (
    <div className="page-content">
      {/* ── Hero anniversaire ── */}
      <div className="anniv-hero hero-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="trophy-ring hero-badge">
          <IconTrophy size={22} color="#F5C542" stroke={1.5} />
        </div>
        <div className="ht-medal hero-medal">
          <Text fz={28} fw={800} c="#6E4E00" lh={1}>25</Text>
          <Text fz={9} fw={700} c="#6E4E00" tt="uppercase" ls={2}>ans</Text>
        </div>
        <Text mt={6} size="xs" fw={600} tt="uppercase" ls={2} c="rgba(255,255,255,0.65)">
          Anniversaire ADES
        </Text>
      </div>

      {/* ── Timeline horizontale : 25 ans de parcours ── */}
      <div ta="center" className="hero-title">
        <Text size="xs" fw={700} tt="uppercase" ls={2} c="light-dark(#B8860B, #D4920A)">Notre histoire</Text>
        <Title order={3} mt={4}>25 ans de parcours</Title>
        <Text size="sm" c="dimmed" mt={4}>Les grandes étapes qui ont façonné l'ADES</Text>
      </div>

      <div className="htl">
        <div className="htl-line" />
        <div className="htl-grid">
          {milestones.map((m, i) => {
            const isFinal = i === milestones.length - 1;
            return (
              <div key={m.year} className={`htl-item ${isFinal ? 'final' : ''} hero-text`} style={{ animationDelay: `${0.12 * i}s` }}>
                <div className="htl-year">{m.year}</div>
                <div className="htl-track">
                  <div className="htl-dot"><m.icon size={10} color={isFinal ? '#6E4E00' : '#2E7D32'} /></div>
                </div>
                <div className="htl-title">{m.title}</div>
                <div className="htl-text">{m.text}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Message de clôture ── */}
      <Flex align="center" gap="md" mt="xl" className="hero-text" style={{ animationDelay: '0.7s', marginBottom: '0.5rem' }}>
        <Divider style={{ flex: 1 }} color="light-dark(#F0E6C8, #3F3A28)" />
        <Group gap={8} wrap="nowrap">
          <IconConfetti size={16} color="#D4920A" />
          <Text fw={600} size="sm" c="light-dark(#8A6A00, #F5C542)">Merci de faire partie de l'aventure</Text>
          <IconConfetti size={16} color="#D4920A" />
        </Group>
        <Divider style={{ flex: 1 }} color="light-dark(#F0E6C8, #3F3A28)" />
      </Flex>
    </div>
  );
}
