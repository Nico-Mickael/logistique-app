const { Conversation, Message, MessageRead } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const messagingService = require('../services/messagingService');
const { emitToUsers } = require('../services/socketService');

// GET /api/messages/unread-count — nombre total de messages non lus (badge).
exports.unreadBadgeCount = asyncHandler(async (req, res) => {
  const count = await messagingService.unreadCountForUser(req.user.id);
  res.json({ count });
});

// PATCH /api/messages/:id — modifier UNIQUEMENT son propre message.
exports.update = asyncHandler(async (req, res) => {
  const message = await Message.findByPk(req.params.id);
  if (!message) return res.status(404).json({ message: 'Message introuvable' });
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ message: 'Vous ne pouvez pas modifier le message d\'un autre utilisateur' });
  }

  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ message: 'Le message ne peut pas être vide' });
  if (content.length > 4000) return res.status(400).json({ message: 'Message trop long (4000 caractères max)' });

  message.content = content;
  await message.save();

  const memberIds = await messagingService.getConversationMemberIds(message.conversation_id);
  emitToUsers(memberIds, 'message_updated', { id: message.id, conversation_id: message.conversation_id, content });

  res.json({ id: message.id, conversation_id: message.conversation_id, content, updated_at: message.updatedAt });
});

// DELETE /api/messages/:id — supprimer UNIQUEMENT son propre message.
exports.remove = asyncHandler(async (req, res) => {
  const message = await Message.findByPk(req.params.id);
  if (!message) return res.status(404).json({ message: 'Message introuvable' });
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ message: 'Vous ne pouvez pas supprimer le message d\'un autre utilisateur' });
  }

  const { conversation_id, id } = message;
  await MessageRead.destroy({ where: { message_id: message.id } });
  await message.destroy();

  const memberIds = await messagingService.getConversationMemberIds(conversation_id);
  emitToUsers(memberIds, 'message_deleted', { id, conversation_id });

  res.json({ message: 'Message supprimé' });
});