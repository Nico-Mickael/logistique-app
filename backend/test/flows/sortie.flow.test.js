const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');
const { app, request, db, seed, login, authHeader, close, loginAll, getSite } = require('../integration/helpers');

describe('Flux Sorties (intégration)', () => {
  let tokens, sortieId, vehicleId, chauffeurId;

  before(async () => {
    await seed();
    tokens = await loginAll();
    chauffeurId = (await db.Employee.findOne({ where: { role: 'chauffeur' } })).id;
  });

  after(async () => { await close(); });

  it('POST /api/sorties — chef crée une sortie', async () => {
    const chauffeur = await db.Employee.findOne({ where: { role: 'chauffeur' } });
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    vehicleId = vehicle.id;
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeur.id,
        destination: 'Antsirabe',
        motif: 'Transport équipe',
        departure_time: new Date(Date.now() + 3600000).toISOString(),
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'planned');
    assert.strictEqual(res.body.destination, 'Antsirabe');
    sortieId = res.body.id;
  });

  it('POST /api/sorties — chauffeur déclaré indisponible refusé (disponibilité)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    // L'assignation dépend de la disponibilité DÉCLARÉE, pas de la connexion :
    // un chauffeur disponible mais non connecté reste assignable ; un chauffeur
    // déclaré indisponible (ici 'offline') ne l'est plus.
    const offlineChauffeur = await db.Employee.create({
      nom: 'Indispo', prenom: 'Test', email: `offline-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
      availability_status: 'offline',
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'Indispo Test',
        driver_employee_id: offlineChauffeur.id,
        destination: 'Toamasina',
        motif: 'Test indisponible',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/indisponible/i.test(res.body.message));
  });

  it('POST /api/sorties — chauffeur en congé refusé (période active)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const start = new Date(today);
    start.setDate(today.getDate() - 1);
    const end = new Date(today);
    end.setDate(today.getDate() + 5);
    const leaveChauffeur = await db.Employee.create({
      nom: 'EnCongé', prenom: 'Test', email: `leave-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
      availability_status: 'on_leave',
      leave_start_date: fmt(start),
      leave_end_date: fmt(end),
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'EnCongé Test',
        driver_employee_id: leaveChauffeur.id,
        destination: 'Toliara',
        motif: 'Test congé',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/indisponible/i.test(res.body.message));
  });

  it('POST /api/sorties — chauffeur dont le congé est terminé accepté (auto-retour)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const end = new Date(today);
    end.setDate(today.getDate() - 1);
    const returnedChauffeur = await db.Employee.create({
      nom: 'Retour', prenom: 'Test', email: `return-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
      availability_status: 'on_leave',
      leave_start_date: fmt(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 10)),
      leave_end_date: fmt(end),
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'Retour Test',
        driver_employee_id: returnedChauffeur.id,
        destination: 'Morondava',
        motif: 'Retour de congé',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  });

  it('POST /api/sorties — chauffeur disponible mais non connecté accepté (pas de présence)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    // Un chauffeur jamais connecté (aucune session/socket) doit rester assignable :
    // sa disponibilité par défaut est 'available'.
    const freshChauffeur = await db.Employee.create({
      nom: 'Farmeur', prenom: 'Test', email: `fresh-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'Farmeur Test',
        driver_employee_id: freshChauffeur.id,
        destination: 'Antsiranana',
        motif: 'Non connecté mais disponible',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  });

  it('GET /api/sorties — la sortie apparaît dans la liste', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.find((s) => s.id === sortieId));
  });

  it('POST /api/sorties/:id/join — employé rejoint une sortie planifiée future', async () => {
    const futureVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: futureVehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Fianarantsoa',
        motif: 'Tournée future',
        departure_time: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${createRes.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 201);

    const prepNotifs = await db.Notification.findAll({ where: { type: 'sortie_prepare' } });
    assert.strictEqual(prepNotifs.length, 0, 'pas de notification "préparez-vous" pour une sortie future');
  });

  it('POST /api/sorties/:id/join — refusé quand le départ est déjà dépassé', async () => {
    const pastVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: pastVehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Mahajanga',
        motif: 'Sortie déjà partie',
        departure_time: new Date(Date.now() - 3600000).toISOString(),
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${createRes.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 400);
    assert.ok(/déjà passé/i.test(res.body.message));
    const links = await db.SortieRequest.findAll({ where: { sortie_id: createRes.body.id } });
    assert.strictEqual(links.length, 0, 'aucune demande créée/liée');
  });

  it('POST /api/sorties/:id/join — autorisé dans la tolérance de 20 min après le départ', async () => {
    const graceVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: graceVehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Antsirabe',
        motif: 'Moto 5 min de retard',
        departure_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${createRes.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 201);

    const prepNotifs = await db.Notification.findAll({ where: { type: 'sortie_prepare' } });
    assert.strictEqual(prepNotifs.length, 1, 'la notification "préparez-vous" est envoyée à l\'employé qui rejoint dans la tolérance');
    assert.ok(/20 minutes/.test(prepNotifs[0].message));
  });

  it('GET /api/sorties/planned — exclut les sorties dont le départ est dépassé', async () => {
    const pastVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const pastSortie = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: pastVehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Toamasina',
        motif: 'Déjà partie',
        departure_time: new Date(Date.now() - 7200000).toISOString(),
      });
    assert.strictEqual(pastSortie.status, 201);

    // Une sortie partie depuis 10 min (≤ tolérance 20 min) reste disponible
    const graceVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const graceSortie = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: graceVehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Tamatave',
        motif: 'Retard toléré',
        departure_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });
    assert.strictEqual(graceSortie.status, 201);

    const res = await request(app)
      .get('/api/sorties/planned')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(!res.body.find((s) => s.id === pastSortie.body.id), 'la sortie déjà partie (2 h) ne doit plus apparaître');
    assert.ok(res.body.find((s) => s.id === graceSortie.body.id), 'la sortie avec retard ≤ 20 min doit rester disponible');
  });

  it('GET /api/sorties/planned — expose l\'itinéraire multi-étapes aux employés', async () => {
    const v = await db.Vehicle.create({ name: `PlannedItin Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Antananarivo',
        motif: 'Itinéraire visible',
        departure_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        stops: ['Antsirabe', ' Ambatondrazaka '],
      });
    assert.strictEqual(created.status, 201);

    const res = await request(app)
      .get('/api/sorties/planned')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    const entry = res.body.find((s) => s.id === created.body.id);
    assert.ok(entry, 'la sortie est listée pour les employés');
    assert.deepStrictEqual(entry.stops, ['Antsirabe', 'Ambatondrazaka'], 'les étapes nettoyées sont exposées pour permettre une demande rapide');
  });

  it('POST /api/sorties/:id/join — la demande est créée PENDING (validation du chef requise)', async () => {
    const v = await db.Vehicle.create({ name: `JoinPending Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Sambava',
        motif: 'Rejoindre à valider',
        departure_time: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));

    const res = await request(app)
      .post(`/api/sorties/${created.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 2 });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const joinedRequest = await db.Request.findByPk(res.body.request_id);
    assert.strictEqual(joinedRequest.status, 'pending', 'la demande de rejoint est EN ATTENTE de validation');
    assert.strictEqual(joinedRequest.nb_personnes, 2);

    const link = await db.SortieRequest.findOne({ where: { request_id: joinedRequest.id } });
    assert.ok(link, 'le lien provisoire sortie↔demande existe');
    assert.strictEqual(link.sortie_id, created.body.id);
    assert.strictEqual(link.status, 'pending');

    const chiefNotif = await db.Notification.findOne({ where: { type: 'new_request' }, order: [['id', 'DESC']] });
    assert.ok(chiefNotif, 'une notification de demande à valider est créée pour la logistique');
    assert.ok(/Sambava/.test(chiefNotif.message), 'la notification fait référence à la sortie rejointe');

    const empPending = await db.Notification.findOne({ where: { user_id: tokens.employee.user.id, type: 'pending' } });
    assert.ok(empPending, 'l\'employé est notifié que sa demande est en attente');

    const approveRes = await request(app)
      .patch(`/api/requests/${joinedRequest.id}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'approved' });
    assert.strictEqual(approveRes.status, 200, JSON.stringify(approveRes.body));

    const approved = await db.Request.findByPk(joinedRequest.id);
    assert.strictEqual(approved.status, 'approved');
    const stillLinked = await db.SortieRequest.findOne({ where: { request_id: joinedRequest.id } });
    assert.ok(stillLinked, 'la demande reste liée à la sortie (pas de recréation)');
    assert.strictEqual(await db.SortieRequest.count({ where: { sortie_id: created.body.id } }), 1, 'aucune nouvelle sortie créée');
  });

  it('POST /api/sorties/:id/join — l\'employé peut choisir une étape comme destination', async () => {
    const v = await db.Vehicle.create({ name: `JoinStop Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Antananarivo',
        motif: 'Étapes joignables',
        departure_time: new Date(Date.now() + 86400000).toISOString(),
        stops: ['Antsirabe', 'Ambalavao'],
      });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));

    const res = await request(app)
      .post(`/api/sorties/${created.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1, destination: 'Antsirabe' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const joinedStop = await db.Request.findByPk(res.body.request_id);
    assert.strictEqual(joinedStop.destination, 'Antsirabe', 'la demande porte l\'étape choisie comme destination');

    // Le même employé ne peut pas re-joindre la même sortie : il a déjà une
    // demande liée → on vérifie la garde de doublon, pas la destination.
    const dup = await request(app)
      .post(`/api/sorties/${created.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1, destination: 'Antsirabe' });
    assert.strictEqual(dup.status, 400);
    assert.ok(/déjà une demande/i.test(dup.body.message));

    // Une destination HORS itinéraire est refusée avant toute création.
    const other = await db.Employee.create({ nom: 'Etape', prenom: 'Test', email: `etape-${Date.now()}@test.com`, password: await bcrypt.hash('Test1234', 10), department: 'RH', role: 'employee', site_id: getSite().id });
    const otherToken = (await request(app).post('/api/auth/login').send({ email: other.email, password: 'Test1234' })).body.accessToken;
    const bad = await request(app)
      .post(`/api/sorties/${created.body.id}/join`)
      .set(authHeader(otherToken))
      .send({ nb_personnes: 1, destination: 'Paris' });
    assert.strictEqual(bad.status, 400);
    assert.ok(/Destination invalide/i.test(bad.body.message));
    const badLink = await db.SortieRequest.findAll({ where: { sortie_id: created.body.id } });
    assert.strictEqual(badLink.length, 1, 'aucune demande créée pour une étape hors itinéraire');
  });

  it('POST /api/sorties/:id/join à faire PATCH /api/requests/:id/status — refus retire le lien provisoire', async () => {
    const v = await db.Vehicle.create({ name: `JoinReject Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Antsiranana',
        motif: 'Rejet du rejoint',
        departure_time: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));

    const res = await request(app)
      .post(`/api/sorties/${created.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 201);

    const rejectRes = await request(app)
      .patch(`/api/requests/${res.body.request_id}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'rejected' });
    assert.strictEqual(rejectRes.status, 200, JSON.stringify(rejectRes.body));

    const rejected = await db.Request.findByPk(res.body.request_id);
    assert.strictEqual(rejected.status, 'rejected');
    const link = await db.SortieRequest.findOne({ where: { request_id: res.body.request_id } });
    assert.strictEqual(link, null, 'le lien provisoire est retiré au refus');
  });

  it('PATCH /api/requests/:id/status — rescheduled refusée pour une demande liée (même en attente)', async () => {
    const v = await db.Vehicle.create({ name: `JoinResched Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Moramanga',
        motif: 'Replanification bloquée',
        departure_time: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.strictEqual(created.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${created.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 201);

    const resched = await request(app)
      .patch(`/api/requests/${res.body.request_id}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'rescheduled', new_date: new Date(Date.now() + 2 * 86400000).toISOString(), reschedule_reason: 'Test' });
    assert.strictEqual(resched.status, 400);
    assert.ok(/rattachée à une sortie/i.test(resched.body.message));
  });

  it('PATCH /api/sorties/:id/validate-return — clôture forcée d\'une moto bloquée en cours', async () => {
    const v = await db.Vehicle.create({ name: `ForceClose Test ${Date.now()}`, type: 'moto', capacity: 1, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Moto Test',
        destination: 'Arivonimamo',
        motif: 'Moto sans retour',
        departure_time: new Date(Date.now() - 3600000).toISOString(),
      });
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));

    const dept = await request(app)
      .patch(`/api/sorties/${created.body.id}/depart`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ departure_km: 1000 });
    assert.strictEqual(dept.status, 200);
    assert.strictEqual(dept.body.status, 'ongoing');

    const blocked = await request(app)
      .patch(`/api/sorties/${created.body.id}/validate-return`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(blocked.status, 400, 'sans force, une sortie "en cours" ne se clôture pas');

    const forced = await request(app)
      .patch(`/api/sorties/${created.body.id}/validate-return`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ force: true });
    assert.strictEqual(forced.status, 200, JSON.stringify(forced.body));
    assert.strictEqual(forced.body.status, 'finished', 'la clôture forcée termine la sortie');
  });

  it('POST /api/sorties — chauffeur manuel sans compte refusé pour une voiture', async () => {
    const v = await db.Vehicle.create({ name: `NoAcc Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Conducteur Libre',
        destination: 'Tsiroanomandidy',
        motif: 'Chauffeur sans compte',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/compte \(rôle chauffeur\)/i.test(res.body.message));

    const moto = await db.Vehicle.create({ name: `NoAccMoto Test ${Date.now()}`, type: 'moto', capacity: 1, status: 'available', site_id: getSite().id });
    const motoRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: moto.id,
        driver_name: 'Conducteur Libre',
        destination: 'Tsiroanomandidy',
        motif: 'Moto sans compte',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(motoRes.status, 201, JSON.stringify(motoRes.body), 'une moto accepte un conducteur libre');
  });

  it('PUT /api/sorties/:id — chef modifie la sortie planifiée', async () => {
    const res = await request(app)
      .put(`/api/sorties/${sortieId}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ destination: 'Antsirabe Centre', motif: 'Transport modifié' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.destination, 'Antsirabe Centre');
  });

  it('PATCH /api/sorties/:id/depart — chef enregistre le départ', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/depart`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ departure_km: 10000 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ongoing');
    assert.strictEqual(res.body.departure_km, 10000);
  });

  it('PATCH /api/sorties/:id/status — chef passe à pending_return', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'pending_return' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'pending_return');
  });

  it('PATCH /api/sorties/:id/validate-return — chef valide le retour', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/validate-return`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'finished');
  });

  it('GET /api/sorties/last/:vehicleId — dernière sortie d\'un véhicule', async () => {
    const res = await request(app)
      .get(`/api/sorties/last/${vehicleId}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body);
  });

  it('DELETE /api/sorties/:id — supprime une sortie terminée (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/sorties/${sortieId}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    // Sortie should be soft-deleted (deleted_at set)
    const sortie = await db.Sortie.findByPk(sortieId);
    assert.ok(sortie.deleted_at);
  });

  it('GET /api/sorties — la sortie supprimée n\'apparaît plus', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.ok(!res.body.data.find((s) => s.id === sortieId));
  });

  it('GET /api/stats/kilometrage — mais reste dans l\'historique', async () => {
    const res = await request(app)
      .get('/api/stats/kilometrage?year=2026')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/sorties — employé sans rôle chef est refusé', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 403);
  });

  it('POST /api/sorties — itinéraire multi-étapes enregistré (nettoyé)', async () => {
    const v = await db.Vehicle.create({ name: `Stops Test ${Date.now()}`, type: 'voiture', capacity: 5, status: 'available', site_id: getSite().id });
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Antananarivo',
        motif: 'Itinéraire étapes',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
        stops: ['Antsirabe', '  Ambatondrazaka  ', '', 'Tana'],
      });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.deepStrictEqual(res.body.stops, ['Antsirabe', 'Ambatondrazaka', 'Tana']);
  });

  it('POST /api/sorties — étapes non-tableau ignorées', async () => {
    const v = await db.Vehicle.create({ name: `Stops2 Test ${Date.now()}`, type: 'voiture', capacity: 4, status: 'available', site_id: getSite().id });
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeurId,
        destination: 'Toamasina',
        motif: 'Étapes invalides',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
        stops: 'pas-un-tableau',
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.stops, null);
  });

  it('PUT /api/sorties/:id — étapes modifiées sur une sortie existante', async () => {
    const v = await db.Vehicle.create({ name: `Stops3 Test ${Date.now()}`, type: 'moto', capacity: 1, status: 'available', site_id: getSite().id });
    const created = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: v.id,
        driver_name: 'Chauffeur Test',
        destination: 'Mahajanga',
        motif: 'Étapes modifiées',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(created.status, 201);

    const upd = await request(app)
      .put(`/api/sorties/${created.body.id}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ stops: ['Fianarantsoa', ' Ambositra '] });
    assert.strictEqual(upd.status, 200);
    assert.deepStrictEqual(upd.body.stops, ['Fianarantsoa', 'Ambositra']);

    const cleared = await request(app)
      .put(`/api/sorties/${created.body.id}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ stops: [] });
    assert.strictEqual(cleared.status, 200);
    assert.strictEqual(cleared.body.stops, null);
  });
});
