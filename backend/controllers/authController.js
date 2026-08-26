const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Employee, Session } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ALL_ROLES } = require('../utils/constants');

const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_DAYS = 7;

function parseDeviceInfo(ua) {
  if (!ua) return 'Inconnu';
  if (/mobile|android|iphone|ipad/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return 'Tablette';
    return 'Mobile';
  }
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Navigateur';
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(employee, sessionId) {
  return jwt.sign(
    { id: employee.id, role: employee.role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

async function createSession(employee, req) {
  const refreshToken = generateRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  const session = await Session.create({
    user_id: employee.id,
    refresh_token_hash: hashToken(refreshToken),
    ip_address: req.ip || req.connection?.remoteAddress || null,
    user_agent: req.headers['user-agent'] || null,
    device_info: parseDeviceInfo(req.headers['user-agent']),
    last_active_at: now,
    expires_at: expiresAt,
    revoked: false,
    createdAt: now,
    updatedAt: now,
  });

  return { session, refreshToken };
}

exports.register = asyncHandler(async (req, res) => {
  const { nom, prenom, email, password, department, role } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ message: 'Champs obligatoires : nom, prenom, email, password' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Format d\'email invalide' });
  }

  if (password.length < 4) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères' });
  }

  const existing = await Employee.findOne({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: 'Cet email est déjà utilisé' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const finalRole = ALL_ROLES.includes(role) ? role : 'employee';

  const employee = await Employee.create({
    nom, prenom, email,
    password: hashedPassword,
    department,
    role: finalRole,
  });

  res.status(201).json({
    id: employee.id,
    nom: employee.nom,
    prenom: employee.prenom,
    email: employee.email,
    role: employee.role,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const employee = await Employee.findOne({ where: { email } });
  if (!employee) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }

  const valid = await bcrypt.compare(password, employee.password);
  if (!valid) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }

  const { session, refreshToken } = await createSession(employee, req);
  const accessToken = signAccessToken(employee, session.id);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: employee.id,
      nom: employee.nom,
      prenom: employee.prenom,
      email: employee.email,
      role: employee.role,
    },
  });
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token manquant' });
  }

  const hash = hashToken(refreshToken);
  const session = await Session.findOne({
    where: { refresh_token_hash: hash, revoked: false },
    include: [{ model: Employee, as: 'user', attributes: ['id', 'nom', 'prenom', 'email', 'role'] }],
  });

  if (!session) {
    return res.status(401).json({ message: 'Session invalide ou révoquée' });
  }

  if (new Date() > new Date(session.expires_at)) {
    session.revoked = true;
    session.revoked_at = new Date();
    await session.save();
    return res.status(401).json({ message: 'Session expirée' });
  }

  const newRefreshToken = generateRefreshToken();
  session.refresh_token_hash = hashToken(newRefreshToken);
  session.last_active_at = new Date();
  session.expires_at = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await session.save();

  const accessToken = signAccessToken(session.user, session.id);

  res.json({ accessToken, refreshToken: newRefreshToken });
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const hash = hashToken(refreshToken);
    await Session.update(
      { revoked: true, revoked_at: new Date() },
      { where: { refresh_token_hash: hash, revoked: false } }
    );
  }

  if (req.user?.sid) {
    await Session.update(
      { revoked: true, revoked_at: new Date() },
      { where: { id: req.user.sid, revoked: false } }
    );
  }

  res.json({ message: 'Déconnexion réussie' });
});

exports.logoutAll = asyncHandler(async (req, res) => {
  await Session.update(
    { revoked: true, revoked_at: new Date() },
    { where: { user_id: req.user.id, revoked: false } }
  );
  res.json({ message: 'Toutes les sessions ont été révoquées' });
});

exports.me = asyncHandler(async (req, res) => {
  const employee = await Employee.findByPk(req.user.id, {
    attributes: ['id', 'nom', 'prenom', 'email', 'department', 'role'],
  });
  if (!employee) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }
  res.json(employee);
});

exports.sessions = asyncHandler(async (req, res) => {
  const sessions = await Session.findAll({
    where: { user_id: req.user.id },
    attributes: ['id', 'device_info', 'ip_address', 'user_agent', 'last_active_at', 'expires_at', 'revoked', 'revoked_at', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });

  const now = new Date();
  const result = sessions.map((s) => ({
    id: s.id,
    device: s.device_info,
    ip: s.ip_address,
    current: s.id === req.user.sid && !s.revoked,
    active: !s.revoked && new Date(s.expires_at) > now,
    lastActive: s.last_active_at,
    createdAt: s.createdAt,
  }));

  res.json(result);
});

exports.revokeSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    where: { id: req.params.id, user_id: req.user.id },
  });

  if (!session) {
    return res.status(404).json({ message: 'Session introuvable' });
  }

  if (session.id === req.user.sid) {
    return res.status(400).json({ message: 'Vous ne pouvez pas révoquer votre propre session active' });
  }

  session.revoked = true;
  session.revoked_at = new Date();
  await session.save();

  res.json({ message: 'Session révoquée' });
});
