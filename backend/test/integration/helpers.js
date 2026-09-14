process.env.NODE_ENV = 'development';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'logistique';
process.env.DB_PASSWORD = 'logistique123';
process.env.DB_NAME = 'logistique_db_integ';
process.env.JWT_SECRET = 'integration_secret_123';
process.env.SERVE_FRONTEND = 'false';

const bcrypt = require('bcrypt');
const db = require('../../models');
const app = require('../../app');
const request = require('supertest');

const BCRYPT_ROUNDS = 10;

// Base seed data
const SUPERADMIN = { nom: 'Super', prenom: 'Admin', email: 'superadmin@test.com', password: 'Test1234', role: 'superadmin', department: 'IT' };
const CHIEF = { nom: 'Chef', prenom: 'Logistique', email: 'chief@test.com', password: 'Test1234', role: 'admin', department: 'Logistique' };
const EMPLOYEE = { nom: 'Employe', prenom: 'Jean', email: 'employee@test.com', password: 'Test1234', role: 'employee', department: 'RH' };
const CHAUFFEUR = { nom: 'Chauffeur', prenom: 'Pierre', email: 'chauffeur@test.com', password: 'Test1234', role: 'chauffeur', department: 'Logistique' };
const VEHICLE = { name: 'Duster Test', type: 'voiture', capacity: 5 };
const VEHICLE2 = { name: 'Clio Test', type: 'voiture', capacity: 4 };

let site;

async function hashPassword(pw) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

async function login(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body;
}

function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function cleanup() {
  const { sequelize } = db;
  await sequelize.query('DELETE FROM "Notifications"');
  await sequelize.query('DELETE FROM "Sessions"');
  await sequelize.query('DELETE FROM "AuditLogs"');
  await sequelize.query('DELETE FROM "PushSubscriptions"');
  await sequelize.query('DELETE FROM "SortieRequests"');
  await sequelize.query('DELETE FROM "Sorties"');
  await sequelize.query('DELETE FROM "Requests"');
  await sequelize.query('DELETE FROM "Employees" WHERE email LIKE \'%@test.com\'');
  await sequelize.query('DELETE FROM "Vehicles" WHERE name LIKE \'%Test%\'');
  await sequelize.query('DELETE FROM "Sites" WHERE name LIKE \'%Test%\'');
}

async function seed() {
  await cleanup();
  const hashedPw = await hashPassword(SUPERADMIN.password);

  // Site par défaut pour tous les tests (site_id est NOT NULL)
  const siteRow = await db.Site.findOne({ where: { name: 'Site Test' } });
  site = siteRow || await db.Site.create({ name: 'Site Test', code: 'TEST', city: 'Antananarivo', address: '1 rue de test', status: 'active' });

  await db.Employee.create({ ...SUPERADMIN, password: hashedPw, site_id: site.id });
  await db.Employee.create({ ...CHIEF, password: hashedPw, site_id: site.id });
  await db.Employee.create({ ...EMPLOYEE, password: hashedPw, site_id: site.id });
  await db.Employee.create({ ...CHAUFFEUR, password: hashedPw, site_id: site.id });

  await db.Vehicle.create({ ...VEHICLE, status: 'available', site_id: site.id });
  await db.Vehicle.create({ ...VEHICLE2, status: 'available', site_id: site.id });

  return { site: site.toJSON() };
}

async function loginAll() {
  const sa = await login(SUPERADMIN.email, SUPERADMIN.password);
  const ch = await login(CHIEF.email, CHIEF.password);
  const emp = await login(EMPLOYEE.email, EMPLOYEE.password);
  const drv = await login(CHAUFFEUR.email, CHAUFFEUR.password);
  return {
    superadmin: { token: sa.accessToken, refresh: sa.refreshToken, user: sa.user },
    chief: { token: ch.accessToken, refresh: ch.refreshToken, user: ch.user },
    employee: { token: emp.accessToken, refresh: emp.refreshToken, user: emp.user },
    chauffeur: { token: drv.accessToken, refresh: drv.refreshToken, user: drv.user },
  };
}

async function close() {
  await db.sequelize.close();
}

module.exports = {
  app, request, db, SUPERADMIN, CHIEF, EMPLOYEE, CHAUFFEUR, VEHICLE, VEHICLE2,
  login, authHeader, cleanup, seed, loginAll, close, hashPassword, getSite: () => site,
};