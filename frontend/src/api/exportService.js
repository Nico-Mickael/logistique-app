import api from './axios';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function download(path, params, filename) {
  const { data } = await api.get(path, { params, responseType: 'blob' });
  triggerDownload(data, filename);
}

export const exportService = {
  fleetReport: (format = 'xlsx') => download('/export/fleet', { format }, `rapport_flotte.${format}`),
  sortiesReport: (params = {}, format = 'xlsx') => download('/export/sorties', { ...params, format }, `rapport_sorties.${format}`),
};
