/**
 * Rate limiter léger en mémoire (pas de Redis).
 * Suffisant pour un usage single-instance.
 * Pour du multi-instance, migrer vers rate-limit-flexible + Redis.
 */
const stores = new Map();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, message = 'Trop de requêtes, réessayez plus tard' } = {}) {
  const keyPrefix = `rl_${windowMs}_${max}`;

  return (req, res, next) => {
    const key = `${keyPrefix}_${req.ip}`;
    const now = Date.now();

    let entry = stores.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      stores.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + windowMs) / 1000));

    if (entry.count > max) {
      return res.status(429).json({ message });
    }

    next();
  };
}

// Nettoyage périodique des entrées expirées (toutes les 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of stores) {
    const windowMs = parseInt(key.split('_')[1], 10);
    if (now - entry.windowStart > windowMs) {
      stores.delete(key);
    }
  }
}, 10 * 60 * 1000);

module.exports = { rateLimit };
