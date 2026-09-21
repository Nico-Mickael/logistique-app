const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const XLSX = require('xlsx');
const { app, request, seed, authHeader, close, loginAll, CHAUFFEUR, db } = require('../integration/helpers');

function buildXlsx(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Utilisateurs');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Flux Employés (intégration)', () => {
  let tokens, employeeId;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('POST /api/employees — superadmin crée un employé', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'TestEmployee', prenom: 'Nouveau', email: 'newemp@test.com', password: 'Test1234', department: 'RH', role: 'employee' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.email, 'newemp@test.com');
    employeeId = res.body.id;
  });

  it('GET /api/employees — superadmin voit tous les employés', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.find((e) => e.id === employeeId));
  });

  it('PUT /api/employees/:id — superadmin modifie un employé', async () => {
    const res = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'TestEmployee', prenom: 'Modifié', department: 'IT' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.prenom, 'Modifié');
    assert.strictEqual(res.body.department, 'IT');
  });

  it('GET /api/employees/chauffeurs — liste les chauffeurs avec statut de présence', async () => {
    const res = await request(app)
      .get('/api/employees/chauffeurs')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const chauffeur = res.body.find((e) => e.email === CHAUFFEUR.email);
    assert.ok(chauffeur, 'chauffeur dans la liste');
    // Par défaut un chauffeur est disponible — sa disponibilité déclarée ne
    // dépend pas de son état de connexion.
    assert.strictEqual(chauffeur.availability_status, 'available');
    assert.ok(typeof chauffeur.last_seen !== 'undefined');
  });

  it('DELETE /api/employees/:id — superadmin supprime un employé', async () => {
    const res = await request(app)
      .delete(`/api/employees/${employeeId}`)
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/employees — employé supprimé n\'apparaît plus', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken));
    assert.ok(!res.body.find((e) => e.id === employeeId));
  });

  it('POST /api/employees — chef non-superadmin refusé', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set(authHeader(tokens.chief.accessToken))
      .send({ nom: 'Fail', prenom: 'Test', email: 'fail@test.com', password: 'Test1234', role: 'employee' });
    assert.strictEqual(res.status, 403);
  });

  it('PUT /api/employees/:id — superadmin change le site', async () => {
    const otherSite = await db.Site.create({ name: 'Site Test 2', code: 'TEST2', city: 'Toamasina', address: '2 rue test', status: 'active' });
    const created = await request(app)
      .post('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'Move', prenom: 'Site', email: 'movesite@test.com', password: 'Test1234', role: 'employee' });
    assert.strictEqual(created.status, 201);

    const res = await request(app)
      .put(`/api/employees/${created.body.id}`)
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ siteId: otherSite.id });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.site_id, otherSite.id);

    const list = await request(app)
      .get('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken));
    const moved = list.body.find((e) => e.id === created.body.id);
    assert.strictEqual(moved.Site?.code, 'TEST2');

    await request(app)
      .delete(`/api/employees/${created.body.id}`)
      .set(authHeader(tokens.superadmin.accessToken));
  });

  it('PUT /api/employees/:id — site invalide refusé', async () => {
    const created = await request(app)
      .post('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'Bad', prenom: 'Site', email: 'badsite@test.com', password: 'Test1234', role: 'employee' });
    const res = await request(app)
      .put(`/api/employees/${created.body.id}`)
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ siteId: 999999 });
    assert.strictEqual(res.status, 400);
    await request(app)
      .delete(`/api/employees/${created.body.id}`)
      .set(authHeader(tokens.superadmin.accessToken));
  });

  it('POST /api/employees/import — importe un fichier Excel avec colonnes auto-détectées', async () => {
    const buffer = buildXlsx([
      { NOM: 'ImportUn', prenom: 'Alice', MAIL: 'import1@test.com', 'département': 'Logistique', ROLE: 'chauffeur', site: 'TEST' },
      { NOM: 'ImportDeux', prenom: 'Bob', MAIL: 'import2@test.com', 'département': 'RH', ROLE: 'employé', site: '' },
    ]);

    const res = await request(app)
      .post('/api/employees/import')
      .set(authHeader(tokens.superadmin.accessToken))
      .field('defaultPassword', 'Import1234')
      .attach('file', buffer, { filename: 'users.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.imported, 2);
    assert.strictEqual(res.body.failed, 0);
    assert.strictEqual(res.body.errors.length, 0);

    const list = await request(app)
      .get('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken));
    const imported = list.body.find((e) => e.email === 'import1@test.com');
    assert.ok(imported, 'utilisateur importé présent');
    assert.strictEqual(imported.role, 'chauffeur');
    assert.strictEqual(imported.department, 'Logistique');
    assert.strictEqual(imported.Site?.code, 'TEST');

    // Mot de passe par défaut utilisable pour se connecter
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'import2@test.com', password: 'Import1234' });
    assert.strictEqual(login.status, 200);
  });

  it('POST /api/employees/import — signale les lignes invalides', async () => {
    const buffer = buildXlsx([
      { Nom: 'Dup', Prenom: 'A', Email: 'dup@test.com' },
      { Nom: 'Dup2', Prenom: 'B', Email: 'dup@test.com' },
      { Nom: 'NoMail', Prenom: 'C' },
      { Nom: 'Bad', Prenom: 'D', Email: 'pas-un-email' },
    ]);

    const res = await request(app)
      .post('/api/employees/import')
      .set(authHeader(tokens.superadmin.accessToken))
      .attach('file', buffer, 'users.xlsx');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.imported, 1);
    assert.strictEqual(res.body.failed, 3);
    assert.ok(res.body.errors.some((e) => e.message.includes('déjà utilisé')));
    assert.ok(res.body.errors.some((e) => e.message.includes('obligatoires')));
    assert.ok(res.body.errors.some((e) => e.message.includes('invalide')));
  });

  it('POST /api/employees/import — fichier manquant refusé', async () => {
    const res = await request(app)
      .post('/api/employees/import')
      .set(authHeader(tokens.superadmin.accessToken))
      .field('defaultPassword', 'Import1234');
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/employees/import — chef non-superadmin refusé', async () => {
    const buffer = buildXlsx([{ Nom: 'X', Prenom: 'Y', Email: 'x@test.com' }]);
    const res = await request(app)
      .post('/api/employees/import')
      .set(authHeader(tokens.chief.accessToken))
      .attach('file', buffer, 'users.xlsx');
    assert.strictEqual(res.status, 403);
  });
});
