import { toast } from 'react-toastify';

const baseStyle = { fontWeight: 500 };

export const notifySuccess = (msg) =>
  toast.success(msg, { style: { ...baseStyle, borderLeft: '4px solid #2E7D32' } });

export const notifyError = (msg) =>
  toast.error(msg, { style: { ...baseStyle, borderLeft: '4px solid #D32F2F' } });

export const notifyInfo = (msg) =>
  toast.info(msg, { style: { ...baseStyle, borderLeft: '4px solid #F5B301' } });

export const notifyWarning = (msg) =>
  toast.warning(msg, { style: { ...baseStyle, borderLeft: '4px solid #E65100' } });
