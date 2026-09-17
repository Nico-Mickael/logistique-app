'use strict';
const { Op } = require('sequelize');
const {
  Conversation, ConversationMember, Message, MessageRead,
  Employee, SortieRequest, Request,
} = require('../models');
const { CHIEF_ROLES } = require('../utils/constants');

// Service métier de la messagerie interne.
// Gère le cycle de vie des conversations liées aux sorties et les opérations
// transverses (membres, lecture, compteurs) réutilisées par les contrôleurs.

// Vérifie qu'un utilisateur est membre d'une conversation.
async function isMember(conversationId, userId) {
  const count = await ConversationMember.count({
    where: { conversation_id: conversationId, user_id: userId },
  });
  return count > 0;
}

// Récupère la conversation "sortie" d'une sortie (ou null).
async function findSortieConversation(sortieId) {
  return Conversation.findOne({ where: { sortie_id: sortieId, type: 'sortie' } });
}

// Crée ou resynchronise la conversation associée à une sortie.
// Participants : chefs du site + chauffeur affecté + employés liés aux
// demandes rattachées + éventuels utilisateurs additionnels (extraMemberIds).
// Les membres qui ne sont plus concernés par la sortie sont retirés.
async function syncSortieConversation(sortie, { extraMemberIds = [] } = {}) {
  if (!sortie || !sortie.id) return null;

  let conversation = await findSortieConversation(sortie.id);
  if (!conversation) {
    conversation = await Conversation.create({ type: 'sortie', sortie_id: sortie.id });
  }

  const memberIds = new Set(extraMemberIds.map(Number));

  const chiefs = await Employee.findAll({
    where: {
      role: { [Op.in]: CHIEF_ROLES },
      ...(sortie.site_id != null ? { site_id: sortie.site_id } : {}),
    },
    attributes: ['id'],
  });
  chiefs.forEach((c) => memberIds.add(c.id));

  if (sortie.driver_employee_id) memberIds.add(Number(sortie.driver_employee_id));

  const links = await SortieRequest.findAll({
    where: { sortie_id: sortie.id },
    attributes: ['request_id'],
  });
  if (links.length > 0) {
    const requests = await Request.findAll({
      where: { id: links.map((l) => l.request_id) },
      attributes: ['employee_id'],
    });
    requests.forEach((r) => memberIds.add(Number(r.employee_id)));
  }

  const current = await ConversationMember.findAll({
    where: { conversation_id: conversation.id },
    attributes: ['user_id'],
  });
  const currentIds = new Set(current.map((m) => Number(m.user_id)));

  for (const id of memberIds) {
    if (id && !currentIds.has(id)) {
      await ConversationMember.create({ conversation_id: conversation.id, user_id: id });
    }
  }
  for (const id of currentIds) {
    if (!memberIds.has(id)) {
      await ConversationMember.destroy({
        where: { conversation_id: conversation.id, user_id: id },
      });
    }
  }

  return conversation;
}

// Supprime la conversation d'une sortie (messages compris).
async function deleteSortieConversation(sortieId) {
  const conversation = await findSortieConversation(sortieId);
  if (!conversation) return;
  const messages = await Message.findAll({
    where: { conversation_id: conversation.id },
    attributes: ['id'],
  });
  const messageIds = messages.map((m) => m.id);
  if (messageIds.length > 0) {
    await MessageRead.destroy({ where: { message_id: messageIds } });
  }
  await Message.destroy({ where: { conversation_id: conversation.id } });
  await ConversationMember.destroy({ where: { conversation_id: conversation.id } });
  await conversation.destroy();
}

// Conversation privée existante entre deux utilisateurs (2 membres exactement).
async function findPrivateConversation(userA, userB) {
  const aMemberships = await ConversationMember.findAll({
    where: { user_id: userA },
    attributes: ['conversation_id'],
  });
  const aCids = new Set(aMemberships.map((m) => m.conversation_id));
  const bMemberships = await ConversationMember.findAll({
    where: { user_id: userB, conversation_id: { [Op.in]: [...aCids] } },
    attributes: ['conversation_id'],
  });
  for (const m of bMemberships) {
    const conversation = await Conversation.findByPk(m.conversation_id);
    if (conversation && conversation.type === 'private') {
      const count = await ConversationMember.count({
        where: { conversation_id: conversation.id },
      });
      if (count === 2) return conversation;
    }
  }
  return null;
}

// Crée (ou réutilise) une conversation privée entre deux utilisateurs.
async function ensurePrivateConversation(userA, userB) {
  const existing = await findPrivateConversation(userA, userB);
  if (existing) return existing;
  const conversation = await Conversation.create({ type: 'private', sortie_id: null });
  await ConversationMember.bulkCreate([
    { conversation_id: conversation.id, user_id: userA },
    { conversation_id: conversation.id, user_id: userB },
  ]);
  return conversation;
}

// Compte les messages non lus d'un utilisateur (toutes conversations confondues).
async function unreadCountForUser(userId) {
  const conversations = await ConversationMember.findAll({
    where: { user_id: userId },
    attributes: ['conversation_id'],
  });
  const conversationIds = conversations.map((c) => c.conversation_id);
  if (conversationIds.length === 0) return 0;

  const readRows = await MessageRead.findAll({
    where: { user_id: userId },
    attributes: ['message_id'],
  });
  const readIds = readRows.map((r) => r.message_id);

  return Message.count({
    where: {
      conversation_id: { [Op.in]: conversationIds },
      sender_id: { [Op.ne]: userId },
      ...(readIds.length > 0 ? { id: { [Op.notIn]: readIds } } : {}),
    },
  });
}

// Marque comme lus tous les messages d'une conversation pour un utilisateur.
// Renvoie le nombre de messages nouvellement marqués lus.
async function markConversationRead(conversationId, userId) {
  const messages = await Message.findAll({
    where: { conversation_id: conversationId, sender_id: { [Op.ne]: userId } },
    attributes: ['id'],
  });
  if (messages.length === 0) return 0;

  const readRows = await MessageRead.findAll({
    where: { user_id: userId },
    attributes: ['message_id'],
  });
  const readIds = new Set(readRows.map((r) => r.message_id));

  const now = new Date();
  const toCreate = messages
    .filter((m) => !readIds.has(m.id))
    .map((m) => ({ message_id: m.id, user_id: userId, read_at: now }));
  if (toCreate.length > 0) {
    await MessageRead.bulkCreate(toCreate);
  }
  return toCreate.length;
}

// Participants d'une conversation (ids).
async function getConversationMemberIds(conversationId) {
  const members = await ConversationMember.findAll({
    where: { conversation_id: conversationId },
    attributes: ['user_id'],
  });
  return members.map((m) => m.user_id);
}

module.exports = {
  isMember,
  findSortieConversation,
  syncSortieConversation,
  deleteSortieConversation,
  findPrivateConversation,
  ensurePrivateConversation,
  unreadCountForUser,
  markConversationRead,
  getConversationMemberIds,
};