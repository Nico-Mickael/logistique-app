'use strict';

// Synonymes de destinations : plusieurs orthographes désignent le même lieu.
// Toute destination est normalisée avant comparaison → "Tana", "Tananarive"
// ou "Antananarive" sont reconnus comme la même destination et regroupés.
const ALIASES = {
  antananarivo: 'antananarivo',
  tana: 'antananarivo',
  tananarive: 'antananarivo',
  anananarive: 'antananarivo',
  mahajanga: 'mahajanga',
  majunga: 'mahajanga',
  toamasina: 'toamasina',
  tamatave: 'toamasina',
  antsiranana: 'antsiranana',
  diego: 'antsiranana',
  diegosuarez: 'antsiranana',
  toliara: 'toliara',
  tulear: 'toliara',
  fianarantsoa: 'fianarantsoa',
  fianar: 'fianarantsoa',
  morondava: 'morondava',
  morandava: 'morondava',
};

function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Normalise une destination : minuscules, sans accents, espaces et tirets
// ramenés à un seul espace, puis résolution des synonymes.
function normalizeDestination(dest) {
  const key = stripAccents(String(dest || ''))
    .toLowerCase()
    .replace(/[-–—_'.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[key] || key;
}

module.exports = { normalizeDestination, ALIASES };