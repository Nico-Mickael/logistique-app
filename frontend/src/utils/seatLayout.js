export function getSeatLayout(type, capacity) {
  if (type === 'moto') {
    return {
      w: 180, h: 90, bodyW: 140, bodyH: 70,
      seats: [
        { id: 0, label: 'Conducteur', x: 20, y: 10, w: 40, h: 28 },
        { id: 1, label: 'Passager', x: 80, y: 10, w: 40, h: 28 },
      ],
    };
  }
  if (type === 'minibus' || capacity > 8) {
    const rows = Math.ceil((capacity - 1) / 4);
    const seats = [
      { id: 0, label: 'Conducteur', x: 22, y: 4, w: 32, h: 22 },
      { id: 1, label: 'Passager', x: 74, y: 4, w: 32, h: 22 },
    ];
    let sid = 2;
    for (let r = 0; r < rows; r++) {
      const cols = Math.min(4, capacity - sid);
      const rowX = 10;
      const rowY = 36 + r * 34;
      const spacing = (120 - cols * 28) / (cols + 1);
      for (let c = 0; c < cols; c++) {
        seats.push({
          id: sid++, label: `R${r + 1}-C${c + 1}`,
          x: Math.round(rowX + spacing + c * (28 + spacing)),
          y: rowY, w: 28, h: 22,
        });
      }
    }
    return { w: 220, h: 40 + rows * 34 + 10, bodyW: 160, bodyH: 30 + rows * 34 + 10, seats };
  }
  const seats = [
    { id: 0, label: 'Conducteur', x: 20, y: 6, w: 38, h: 26 },
    { id: 1, label: 'Passager', x: 82, y: 6, w: 38, h: 26 },
    { id: 2, label: 'Arrière G', x: 10, y: 52, w: 34, h: 26 },
    { id: 3, label: 'Arrière C', x: 53, y: 52, w: 34, h: 26 },
    { id: 4, label: 'Arrière D', x: 96, y: 52, w: 34, h: 26 },
  ];
  return { w: 220, h: 100, bodyW: 160, bodyH: 90, seats };
}

export function getSeatColor(state) {
  switch (state) {
    case 'occupied': return { fill: '#D32F2F', stroke: '#B71C1C' };
    case 'reserved': return { fill: '#F5B301', stroke: '#C79000' };
    case 'unavailable': return { fill: '#BDBDBD', stroke: '#9E9E9E' };
    case 'this_request': return { fill: '#2196F3', stroke: '#1565C0' };
    default: return { fill: '#4CAF50', stroke: '#388E3C' };
  }
}
