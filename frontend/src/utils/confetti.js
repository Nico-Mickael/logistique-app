const KEY = 'ades_confetti_at';

export function markConfetti() {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.dispatchEvent(new Event('ades-confetti'));
  } catch { /* ignore */ }
}

export function consumeConfetti() {
  try {
    const at = Number(sessionStorage.getItem(KEY) || 0);
    if (!at || Date.now() - at > 6000) return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
