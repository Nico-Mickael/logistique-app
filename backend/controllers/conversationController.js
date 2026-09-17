const { Op } = require('sequelize');
const {
  Conversation, ConversationMember, Message, MessageRead, Employee, Sortie,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const messagingService = require('../services/messagingService');
const { emitToUsers } = require('../services/socketService');
const { createNotification } = require('./notificationController');

// Normalise une conversation pour la liste / le détail.
function serializeConversation(conversation, { currentUserId, messages, readIds, readsByMessage }) {
  const participants = (conversation.ConversationMembers || [])
    .filter((m) => m.user_id !== currentUserId)
    .map((m) => m.Employee)
    .filter(Boolean);

  const lastMessage = (messages || [])[messages.length - 1] || null;

  const unreadCount = (messages || []).filter(
    (m) => m.sender_id !== currentUserId && !readIds.has(m.id)
  ).length;

  return {
    id: conversation.id,
    type: conversation.type,
    sortie_id: conversation.sortie_id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    sortie: conversation.Sortie ? {
      id: conversation.Sortie.id,
      destination: conversation.Sortie.destination,
      departure_time: conversation.Sortie.departure_time,
      status: conversation.Sortie.status,
    } : null,
    participants: participants.map((p) => ({
      id: p.id, prenom: p.prenom, nom: p.nom, role: p.role,
      availability_status: p.availability_status,
    })),
    last_message: lastMessage ? {
      id: lastMessage.id,
      content: lastMessage.content,
      created_at: lastMessage.createdAt,
      sender_id: lastMessage.sender_id,
    } : null,
    unread_count: unreadCount,
  };
}

// GET /api/conversations — liste des conversations de l'utilisateur connecté.
exports.list = asyncHandler(async (req, res) => {
  const memberships = await ConversationMember.findAll({
    where: { user_id: req.user.id },
    attributes: ['conversation_id'],
  });
  const conversationIds = memberships.map((m) => m.conversation_id);
  if (conversationIds.length === 0) return res.json({ data: [] });

  const conversations = await Conversation.findAll({
    where: { id: { [Op.in]: conversationIds } },
    include: [
      { model: ConversationMember, include: [{ model: Employee, attributes: ['id', 'prenom', 'nom', 'role', 'availability_status'] }] },
      { model: Sortie, attributes: ['id', 'destination', 'departure_time', 'status'] },
    ],
  });

  const messages = await Message.findAll({
    where: { conversation_id: { [Op.in]: conversationIds } },
    order: [['createdAt', 'ASC']],
    attributes: ['id', 'conversation_id', 'sender_id', 'content', 'createdAt'],
  });
  const readRows = await MessageRead.findAll({ where: { user_id: req.user.id }, attributes: ['message_id'] });
  const readIds = new Set(readRows.map((r) => r.message_id));

  const byConversation = new Map();
  messages.forEach((m) => {
    if (!byConversation.has(m.conversation_id)) byConversation.set(m.conversation_id, []);
    byConversation.get(m.conversation_id).push(m);
  });

  const data = conversations
    .map((c) => serializeConversation(c, {
      currentUserId: req.user.id,
      messages: byConversation.get(c.id) || [],
      readIds,
    }))
    .sort((a, b) => {
      const ta = a.last_message?.created_at || a.updatedAt;
      const tb = b.last_message?.created_at || b.updatedAt;
      return new Date(tb) - new Date(ta);
    });

  res.json({ data });
});

// GET /api/conversations/:id — détail d'une conversation (membre uniquement).
exports.detail = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id, {
    include: [
      { model: ConversationMember, include: [{ model: Employee, attributes: ['id', 'prenom', 'nom', 'role', 'availability_status'] }] },
      { model: Sortie, attributes: ['id', 'destination', 'departure_time', 'status'] },
    ],
  });
  if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
  if (!(await messagingService.isMember(conversation.id, req.user.id))) {
    return res.status(403).json({ message: 'Accès refusé à cette conversation' });
  }

  const messages = await Message.findAll({
    where: { conversation_id: conversation.id },
    order: [['createdAt', 'ASC']],
  });
  const readRows = await MessageRead.findAll({ where: { user_id: req.user.id }, attributes: ['message_id'] });
  const readIds = new Set(readRows.map((r) => r.message_id));

  res.json(serializeConversation(conversation, { currentUserId: req.user.id, messages, readIds }));
});

// POST /api/conversations — conversation privée avec un autre utilisateur.
exports.create = asyncHandler(async (req, res) => {
  const recipientId = Number(req.body.recipient_id);
  if (!recipientId) return res.status(400).json({ message: 'recipient_id est requis' });
  if (recipientId === req.user.id) return res.status(400).json({ message: 'Impossible de discuter avec soi-même' });

  const recipient = await Employee.findByPk(recipientId);
  if (!recipient) return res.status(404).json({ message: 'Utilisateur introuvable' });

  // Multi-sites : on n'autorise pas de lancer une conversation privée avec un
  // utilisateur d'un autre site (sauf superadmin).
  if (req.user.role !== 'superadmin' && recipient.site_id !== req.user.site_id) {
    return res.status(403).json({ message: 'Accès refusé à cet utilisateur' });
  }

  const conversation = await messagingService.ensurePrivateConversation(req.user.id, recipientId);

  const full = await Conversation.findByPk(conversation.id, {
    include: [
      { model: ConversationMember, include: [{ model: Employee, attributes: ['id', 'prenom', 'nom', 'role', 'availability_status'] }] },
    ],
  });
  const readRows = await MessageRead.findAll({ where: { user_id: req.user.id }, attributes: ['message_id'] });

  res.status(201).json(serializeConversation(full, {
    currentUserId: req.user.id,
    messages: await Message.findAll({ where: { conversation_id: conversation.id } }),
    readIds: new Set(readRows.map((r) => r.message_id)),
  }));
});

// GET /api/conversations/users — recherche d'utilisateurs pour lancer un chat.
exports.users = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const where = {
    id: { [Op.ne]: req.user.id },
    ...(req.user.role !== 'superadmin' ? { site_id: req.user.site_id } : {}),
  };
  if (search) {
    where[Op.or] = [
      { prenom: { [Op.iLike]: `%${search}%` } },
      { nom: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const users = await Employee.findAll({
    where,
    attributes: ['id', 'prenom', 'nom', 'email', 'role', 'availability_status', 'site_id'],
    order: [['prenom', 'ASC']],
    limit: 30,
  });

  res.json({ data: users });
});

// GET /api/conversations/:id/messages — messages d'une conversation (membre).
exports.messages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id);
  if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
  if (!(await messagingService.isMember(conversation.id, req.user.id))) {
    return res.status(403).json({ message: 'Accès refusé à cette conversation' });
  }

  const messages = await Message.findAll({
    where: { conversation_id: conversation.id },
    order: [['createdAt', 'ASC']],
    include: [{ model: Employee, as: 'sender', attributes: ['id', 'prenom', 'nom'] }],
  });

  const messageIds = messages.map((m) => m.id);
  const reads = messageIds.length
    ? await MessageRead.findAll({ where: { message_id: { [Op.in]: messageIds } } })
    : [];
  const readsByMessage = new Map();
  reads.forEach((r) => {
    if (!readsByMessage.has(r.message_id)) readsByMessage.set(r.message_id, []);
    readsByMessage.get(r.message_id).push(r.user_id);
  });

  const data = messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    read_by: readsByMessage.get(m.id) || [],
    read_by_me: (readsByMessage.get(m.id) || []).includes(req.user.id),
  }));

  res.json({ data });
});

// POST /api/conversations/:id/messages — envoi d'un message (membre).
exports.send = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id);
  if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
  if (!(await messagingService.isMember(conversation.id, req.user.id))) {
    return res.status(403).json({ message: 'Accès refusé à cette conversation' });
  }

  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ message: 'Le message ne peut pas être vide' });
  if (content.length > 4000) return res.status(400).json({ message: 'Message trop long (4000 caractères max)' });

  const message = await Message.create({
    conversation_id: conversation.id,
    sender_id: req.user.id,
    content,
  });

  // Le message de l'auteur est lu par défaut pour lui.
  await MessageRead.create({ message_id: message.id, user_id: req.user.id, read_at: new Date() });

  const memberIds = await messagingService.getConversationMemberIds(conversation.id);
  const payload = {
    id: message.id,
    conversation_id: conversation.id,
    sender_id: req.user.id,
    content: message.content,
    created_at: message.createdAt,
  };

  // Temps réel : tous les participants reçoivent le nouveau message.
  emitToUsers(memberIds, 'new_message', payload);

  // Notification persistée (cloche) pour les autres participants, sans email.
  await Promise.all(
    memberIds
      .filter((id) => id !== req.user.id)
      .map((id) => createNotification({
        user_id: id,
        message: `Nouveau message de ${req.user.prenom} ${req.user.nom}`,
        type: 'new_message',
        noEmail: true,
      }))
  );

  res.status(201).json({
    ...payload,
    read_by: [req.user.id],
    read_by_me: true,
  });
});

// POST /api/conversations/:id/read — marque les messages comme lus pour l'utilisateur.
exports.markRead = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id);
  if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
  if (!(await messagingService.isMember(conversation.id, req.user.id))) {
    return res.status(403).json({ message: 'Accès refusé à cette conversation' });
  }

  const marked = await messagingService.markConversationRead(conversation.id, req.user.id);
  const unreadTotal = await messagingService.unreadCountForUser(req.user.id);

  res.json({ marked, unread_total: unreadTotal });
});