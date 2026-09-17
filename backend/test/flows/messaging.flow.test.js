const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, seed, authHeader, close, loginAll, getSite } = require('../integration/helpers');

describe('Flux Messagerie (intégration)', () => {
  let tokens, employeeId, chauffeurId, privateConvId, sentMsgId, otherMsgId, sortieConvId;

  before(async () => {
    await seed();
    tokens = await loginAll();
    const employee = await db.Employee.findOne({ where: { email: 'employee@test.com' } });
    const chauffeur = await db.Employee.findOne({ where: { email: 'chauffeur@test.com' } });
    employeeId = employee.id;
    chauffeurId = chauffeur.id;
  });

  after(async () => { await close(); });

  it('POST /api/conversations — l\'employé démarre une conversation privée avec le chauffeur', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set(authHeader(tokens.employee.accessToken))
      .send({ recipient_id: chauffeurId });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.type, 'private');
    assert.ok(res.body.participants.some((p) => p.id === chauffeurId));
    privateConvId = res.body.id;
  });

  it('POST /api/conversations — la même conversation privée est réutilisée', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set(authHeader(tokens.employee.accessToken))
      .send({ recipient_id: chauffeurId });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.id, privateConvId);
  });

  it('POST /api/conversations/:id/messages — envoi d\'un message', async () => {
    const res = await request(app)
      .post(`/api/conversations/${privateConvId}/messages`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ content: 'Bonjour, départ à 10h.' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.content, 'Bonjour, départ à 10h.');
    sentMsgId = res.body.id;
  });

  it('POST /api/conversations/:id/messages — message vide refusé', async () => {
    const res = await request(app)
      .post(`/api/conversations/${privateConvId}/messages`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ content: '   ' });
    assert.strictEqual(res.status, 400);
  });

  it('GET /api/conversations/:id/messages — le chauffeur (membre) lit les messages', async () => {
    const res = await request(app)
      .get(`/api/conversations/${privateConvId}/messages`)
      .set(authHeader(tokens.chauffeur.accessToken));
    assert.strictEqual(res.status, 200);
    const list = res.body.data;
    assert.ok(list.some((m) => m.id === sentMsgId));
    assert.strictEqual(list.find((m) => m.id === sentMsgId).read_by_me, false);
  });

  it('GET /api/conversations/:id/messages — le superadmin (non membre) est refusé', async () => {
    const res = await request(app)
      .get(`/api/conversations/${privateConvId}/messages`)
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 403);
  });

  it('POST /api/conversations/:id/messages — un non membre ne peut pas poster', async () => {
    const res = await request(app)
      .post(`/api/conversations/${privateConvId}/messages`)
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ content: 'intrusion' });
    assert.strictEqual(res.status, 403);
  });

  it('GET /api/messages/unread-count — le chauffeur a 1 message non lu', async () => {
    const res = await request(app)
      .get('/api/messages/unread-count')
      .set(authHeader(tokens.chauffeur.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 1);
  });

  it('POST /api/conversations/:id/read — marque lu et le compteur retombe à 0', async () => {
    const res = await request(app)
      .post(`/api/conversations/${privateConvId}/read`)
      .set(authHeader(tokens.chauffeur.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.marked, 1);
    assert.strictEqual(res.body.unread_total, 0);

    const badge = await request(app)
      .get('/api/messages/unread-count')
      .set(authHeader(tokens.chauffeur.accessToken));
    assert.strictEqual(badge.body.count, 0);
  });

  it('PATCH /api/messages/:id — seul l\'auteur peut modifier', async () => {
    const created = await request(app)
      .post(`/api/conversations/${privateConvId}/messages`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ content: 'message autre' });
    otherMsgId = created.body.id;

    const denied = await request(app)
      .patch(`/api/messages/${otherMsgId}`)
      .set(authHeader(tokens.chauffeur.accessToken))
      .send({ content: 'piratage' });
    assert.strictEqual(denied.status, 403);

    const ok = await request(app)
      .patch(`/api/messages/${otherMsgId}`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ content: 'message modifié' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.content, 'message modifié');
  });

  it('DELETE /api/messages/:id — seul l\'auteur peut supprimer', async () => {
    const denied = await request(app)
      .delete(`/api/messages/${otherMsgId}`)
      .set(authHeader(tokens.chauffeur.accessToken));
    assert.strictEqual(denied.status, 403);

    const ok = await request(app)
      .delete(`/api/messages/${otherMsgId}`)
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(ok.status, 200);
  });

  it('GET /api/conversations — l\'employé voit la conversation privée', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.some((c) => c.id === privateConvId));
  });

  it('Création de sortie : la conversation sortie est créée automatiquement avec ses membres', async () => {
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle.id,
        destination: 'Antsirabe',
        motif: 'Livraison messagerie',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 201);
    const sortieId = res.body.id;

    const conv = await db.Conversation.findOne({ where: { sortie_id: sortieId, type: 'sortie' } });
    assert.ok(conv, 'la conversation de la sortie doit exister');
    sortieConvId = conv.id;

    const memberIds = (await db.ConversationMember.findAll({
      where: { conversation_id: conv.id },
      attributes: ['user_id'],
    })).map((m) => m.user_id);
    // Le créateur (chef) est toujours membre.
    const chief = await db.Employee.findOne({ where: { email: 'chief@test.com' } });
    assert.ok(memberIds.includes(chief.id));
  });

  it('Ajout d\'une demande à une sortie : l\'employé devient membre et peut discuter', async () => {
    const vehicle = (await db.Vehicle.findOne({ where: { status: 'available' }, order: [['id', 'ASC']] }));
    assert.ok(vehicle, 'un véhicule disponible doit exister pour l\'auto-création de sortie');
    const created = await request(app)
      .post('/api/requests')
      .set(authHeader(tokens.employee.accessToken))
      .send({
        destination: 'Toliary',
        motif: 'Réunion terrain',
        date_souhaitee: new Date(Date.now() + 10800000).toISOString(),
        nb_personnes: 1,
        vehicle_id: vehicle.id,
      });
    assert.strictEqual(created.status, 201);
    const requestId = created.body.id;

    const approved = await request(app)
      .patch(`/api/requests/${requestId}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'approved' });
    assert.strictEqual(approved.status, 200);

    // L'employé est membre de la conversation de la sortie générée.
    const link = await db.SortieRequest.findOne({ where: { request_id: requestId } });
    assert.ok(link);
    const conv = await db.Conversation.findOne({ where: { sortie_id: link.sortie_id, type: 'sortie' } });
    assert.ok(conv);
    const isMember = (await db.ConversationMember.count({ where: { conversation_id: conv.id, user_id: employeeId } })) === 1;
    assert.ok(isMember);

    // L'employé peut poster dans la conversation de la sortie.
    const msg = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ content: 'Nous serons 3 personnes.' });
    assert.strictEqual(msg.status, 201);
  });

  it('GET /api/conversations/users — recherche d\'un collègue', async () => {
    const res = await request(app)
      .get('/api/conversations/users')
      .query({ search: 'Pierre' })
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.some((u) => u.email === 'chauffeur@test.com'));
  });

  it('Suppression de sortie : la conversation sortie est supprimée', async () => {
    const conv = await db.Conversation.findByPk(sortieConvId);
    assert.ok(conv);
    await request(app)
      .delete(`/api/sorties/${conv.sortie_id}`)
      .set(authHeader(tokens.chief.accessToken));
    const gone = await db.Conversation.findByPk(sortieConvId);
    assert.ok(!gone, 'la conversation liée à la sortie supprimée doit disparaître');
  });
});