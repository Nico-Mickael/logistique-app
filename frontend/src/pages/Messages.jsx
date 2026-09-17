import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Paper, Group, Text, ActionIcon, Avatar, Badge, Loader, Center, Stack,
  TextInput, Textarea, ScrollArea, UnstyledButton, Tooltip, Divider,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft, IconMessages, IconSend, IconSearch, IconPlus, IconPencil,
  IconTrash, IconRoute, IconX, IconCheck,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { messageService } from '../api/messageService';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { availabilityStatusLabel, availabilityStatusDot } from '../utils/labels';
import { notifyError, notifyInfo } from '../utils/toast';

const initials = (u) => (u ? `${(u.prenom || '')[0] || ''}${(u.nom || '')[0] || ''}`.toUpperCase() : '');

const fmtTime = (iso) => (iso ? dayjs(iso).format('HH:mm') : '');
const fmtConvTime = (iso) => {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isSame(dayjs(), 'day') ? d.format('HH:mm') : d.format('DD/MM/YYYY');
};

function AvatarWithDot({ user }) {
  const color = user?.availability_status ? availabilityStatusDot[user.availability_status] || '#9098a3' : '#9098a3';
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <Avatar size={38} radius="xl" color="brand" variant="light">{initials(user)}</Avatar>
      <span
        title={user?.availability_status ? availabilityStatusLabel[user.availability_status] : ''}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%',
          background: color, border: '2px solid var(--mantine-color-body)',
        }}
      />
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const { refreshUnreadMessages, subscribeSocket } = useSocket();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 992px)');

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('list'); // 'list' | 'new'
  const [newSession, setNewSession] = useState(0);
  const [users, setUsers] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const endRef = useRef(null);
  const activeIdRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await messageService.conversations.list();
      setConversations(Array.isArray(data) ? data : data?.data || []);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const openConversation = useCallback(async (id) => {
    setActiveId(id);
    setLoadingMessages(true);
    try {
      const { data } = await messageService.conversations.messages(id);
      setMessages(Array.isArray(data) ? data : data?.data || []);
      await messageService.conversations.markRead(id);
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
      refreshUnreadMessages();
      scrollToBottom();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur de chargement des messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [refreshUnreadMessages, scrollToBottom]);

  const startConversation = useCallback(async (otherUser) => {
    try {
      const { data } = await messageService.conversations.create(otherUser.id);
      setConversations((prev) => [data, ...prev.filter((c) => c.id !== data.id)]);
      setSearch('');
      setMode('list');
      await openConversation(data.id);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la création de la conversation');
    }
  }, [openConversation]);

  // Recherche d'utilisateurs (nouvelle conversation).
  // Au clic sur « + » : on affiche directement tous les utilisateurs du site.
  useEffect(() => {
    if (mode !== 'new') return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchingUsers(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await messageService.conversations.users(search.trim());
        setUsers(Array.isArray(data) ? data : data?.data || []);
      } catch {
        setUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    }, search.trim() ? 250 : 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, mode, newSession]);

  const onNewMessage = useCallback((data) => {
    if (!data?.conversation_id) return;
    const cid = Number(data.conversation_id);
    if (data.sender_id === user?.id) return;
    if (activeIdRef.current === cid) {
      setMessages((prev) => [...prev, data]);
      messageService.conversations.markRead(cid)
        .then(() => refreshUnreadMessages())
        .catch(() => {});
      scrollToBottom();
    } else {
      setConversations((prev) => prev.map((c) => (
        c.id === cid
          ? {
              ...c,
              unread_count: c.unread_count + 1,
              last_message: { ...c.last_message, content: data.content, created_at: data.created_at },
            }
          : c
      )));
    }
  }, [user?.id, refreshUnreadMessages, scrollToBottom]);

  const onMessageUpdated = useCallback((data) => {
    if (activeIdRef.current === Number(data?.conversation_id)) {
      setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, content: data.content } : m)));
    }
  }, []);

  const onMessageDeleted = useCallback((data) => {
    if (activeIdRef.current === Number(data?.conversation_id)) {
      setMessages((prev) => prev.filter((m) => m.id !== data.id));
    }
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribeSocket('new_message', onNewMessage),
      subscribeSocket('message_updated', onMessageUpdated),
      subscribeSocket('message_deleted', onMessageDeleted),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [subscribeSocket, onNewMessage, onMessageUpdated, onMessageDeleted]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const activePartner = useMemo(
    () => (activeConversation?.participants?.length === 1 ? activeConversation.participants[0] : null),
    [activeConversation]
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setDraft('');
    const optimistic = {
      id: `tmp-${Date.now()}`, conversation_id: activeId, sender_id: user.id,
      content: text, created_at: new Date().toISOString(), read_by: [user.id], read_by_me: true,
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();
    try {
      const { data: created } = await messageService.conversations.send(activeId, text);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? created : m)));
      setConversations((prev) => prev.map((c) => (
        c.id === activeId ? { ...c, last_message: { ...c.last_message, content: text } } : c
      )));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      notifyError(err.response?.data?.message || "Échec de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    const content = editContent.trim();
    if (!content || !editId) return;
    try {
      const { data: updated } = await messageService.messages.update(editId, content);
      setMessages((prev) => prev.map((m) => (m.id === editId ? { ...m, content: updated.content } : m)));
      setEditId(null);
      setEditContent('');
      notifyInfo('Message modifié');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Impossible de modifier le message');
    }
  };

  const deleteMessage = async (id) => {
    try {
      await messageService.messages.remove(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      notifyInfo('Message supprimé');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Impossible de supprimer le message');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const names = (c.participants || []).map((p) => `${p.prenom} ${p.nom}`.toLowerCase()).join(' ');
      const sortieLabel = c.sortie ? `sortie #${c.sortie.id} ${c.sortie.destination}`.toLowerCase() : '';
      return names.includes(q) || sortieLabel.includes(q) || `${c.destination || ''}`.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  const convSubtitle = (c) => {
    if (c.type === 'sortie') {
      const s = c.sortie;
      return s
        ? `Sortie #${s.id} · ${s.destination} · ${dayjs(s.departure_time).format('DD/MM/YYYY HH:mm')}`
        : `Conversation de sortie #${c.sortie_id}`;
    }
    const p = c.participants?.[0];
    return p ? `${p.prenom} ${p.nom}` : 'Conversation';
  };

  const convLabel = (c) => {
    if (c.type === 'sortie') {
      const s = c.sortie;
      return s ? `Sortie #${s.id} · ${s.destination}` : `Sortie #${c.sortie_id}`;
    }
    const p = c.participants?.[0];
    return p ? `${p.prenom} ${p.nom}` : 'Conversation';
  };

  // --- Rendu : liste des conversations (paneau gauche) ---
  const renderList = (
    <Paper withBorder radius="md" className="msg-pane" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Group justify="space-between" px="md" py="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <IconMessages size={18} />
          <Text fw={600} size="sm">Messagerie</Text>
        </Group>
        <Tooltip label="Nouveau message" position="bottom" withArrow>
          <ActionIcon variant="light" color="brand" onClick={() => { setMode('new'); setSearch(''); setUsers([]); setNewSession((n) => n + 1); }} aria-label="Nouveau message">
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Divider />

      <div style={{ padding: '8px 12px' }}>
        <TextInput
          size="xs"
          placeholder={mode === 'new' ? 'Rechercher un utilisateur...' : 'Rechercher...'}
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={search ? (
            <ActionIcon size="sm" variant="transparent" onClick={() => setSearch('')}><IconX size={14} /></ActionIcon>
          ) : undefined}
        />
      </div>

      <ScrollArea.Autosize mah={isMobile ? '55vh' : undefined} style={{ flex: 1 }}>
        {mode === 'new' ? (
          <Stack gap={2} p="xs">
            {searchingUsers ? (
              <Center py="lg"><Loader size="sm" /></Center>
            ) : users.length === 0 ? (
              <Center py="lg">
                <Text size="sm" c="dimmed">
                  {search.trim() ? 'Aucun utilisateur trouvé' : "Aucun autre utilisateur sur votre site"}
                </Text>
              </Center>
            ) : (
              users.map((u) => (
                <UnstyledButton
                  key={u.id}
                  p="xs"
                  style={{ borderRadius: 8 }}
                  className="msg-item"
                  onClick={() => startConversation(u)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <AvatarWithDot user={u} />
                    <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
                      {u.prenom} {u.nom}
                      <Text component="span" size="xs" c="dimmed" fw={400}> · {u.email}</Text>
                    </Text>
                    <ActionIcon size="sm" color="brand" variant="light"><IconMessages size={14} /></ActionIcon>
                  </Group>
                </UnstyledButton>
              ))
            )}
          </Stack>
        ) : loadingList ? (
          <Center py="lg"><Loader size="sm" /></Center>
        ) : filteredConversations.length === 0 ? (
          <Center py="lg" px="md">
            <Text size="sm" c="dimmed" ta="center">
              {search.trim() ? 'Aucune conversation trouvée' : 'Aucune conversation. Cliquez sur + pour démarrer un échange.'}
            </Text>
          </Center>
        ) : (
          <Stack gap={2} p="xs">
            {filteredConversations.map((c) => {
              const p = c.participants?.[0];
              const active = c.id === activeId;
              return (
                <UnstyledButton
                  key={c.id}
                  p="xs"
                  className="msg-item"
                  data-active={active || undefined}
                  style={{ borderRadius: 8 }}
                  onClick={() => { if (isMobile) setActiveId(c.id); openConversation(c.id); }}
                >
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    {c.type === 'sortie' ? (
                      <Avatar size={38} radius="xl" color="brandYellow" variant="light"><IconRoute size={18} /></Avatar>
                    ) : (
                      <AvatarWithDot user={p} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap={4}>
                        <Text size="sm" fw={active ? 700 : 500} truncate>{convLabel(c)}</Text>
                        {c.last_message?.created_at && (
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{fmtConvTime(c.last_message.created_at)}</Text>
                        )}
                      </Group>
                      <Group justify="space-between" wrap="nowrap" gap={4}>
                        <Text size="xs" c="dimmed" truncate style={{ flex: 1, minWidth: 0 }}>
                          {c.last_message ? c.last_message.content : 'Aucun message'}
                        </Text>
                        {c.unread_count > 0 && (
                          <Badge size="xs" radius="xl" color="red" variant="filled" style={{ flexShrink: 0 }}>
                            {c.unread_count > 99 ? '99+' : c.unread_count}
                          </Badge>
                        )}
                      </Group>
                    </div>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );

  // --- Rendu : fil de conversation (paneau droit) ---
  const renderThread = (
    <Paper withBorder radius="md" className="msg-pane" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!activeConversation ? (
        <Center style={{ flex: 1, flexDirection: 'column', gap: 8 }}>
          <IconMessages size={40} stroke={1.2} />
          <Text c="dimmed" size="sm">Sélectionnez une conversation</Text>
        </Center>
      ) : (
        <>
          <Group px="md" py="xs" gap="sm" wrap="nowrap">
            {isMobile && (
              <ActionIcon variant="subtle" onClick={() => { setActiveId(null); setMessages([]); }} aria-label="Retour">
                <IconArrowLeft size={18} />
              </ActionIcon>
            )}
            {activeConversation.type === 'sortie'
              ? <Avatar size={36} radius="xl" color="brandYellow" variant="light"><IconRoute size={18} /></Avatar>
              : <AvatarWithDot user={activePartner} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={600} truncate>
                {activeConversation.type === 'sortie' ? convLabel(activeConversation) : (activePartner ? `${activePartner.prenom} ${activePartner.nom}` : 'Conversation')}
              </Text>
              {activeConversation.type === 'sortie' ? (
                <Text size="xs" c="dimmed" truncate>{convSubtitle(activeConversation)} · {activeConversation.participants?.length || 0} participant(s)</Text>
              ) : (
                activePartner ? (
                  <Text size="xs" c="dimmed">
                    {availabilityStatusLabel[activePartner.availability_status] || activePartner.availability_status}
                  </Text>
                ) : null
              )}
            </div>
            {activeConversation.unread_count > 0 && <Badge size="sm" radius="xl" color="red" variant="filled">{activeConversation.unread_count}</Badge>}
            <Tooltip label="Quitter la messagerie" position="bottom" withArrow>
              <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/')} aria-label="Quitter la messagerie">
                <IconX size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Divider />

          <ScrollArea.Autosize style={{ flex: 1 }} mah={isMobile ? '48vh' : undefined}>
            <Stack p="md" gap={6}>
              {loadingMessages ? (
                <Center py="lg"><Loader size="sm" /></Center>
              ) : messages.length === 0 ? (
                <Center py="lg">
                  <Text size="sm" c="dimmed">Aucun message. Écrivez le premier message !</Text>
                </Center>
              ) : (
                messages.map((m) => {
                  const mine = Number(m.sender_id) === user.id;
                  const isEditing = editId === m.id;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div
                        className={mine ? 'msg-bubble msg-mine' : 'msg-bubble msg-theirs'}
                        style={{ maxWidth: isMobile ? '82%' : '62%' }}
                      >
                        {isEditing ? (
                          <Group gap={4} wrap="nowrap">
                            <TextInput
                              size="xs"
                              value={editContent}
                              onChange={(e) => setEditContent(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                                if (e.key === 'Escape') { setEditId(null); setEditContent(''); }
                              }}
                              autoFocus
                              style={{ flex: 1 }}
                            />
                            <ActionIcon size="sm" color="brand" onClick={saveEdit}><IconCheck size={14} /></ActionIcon>
                            <ActionIcon size="sm" color="gray" onClick={() => { setEditId(null); setEditContent(''); }}><IconX size={14} /></ActionIcon>
                          </Group>
                        ) : (
                          <>
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</Text>
                            <Group gap={6} justify={mine ? 'flex-end' : 'flex-start'} mt={2}>
                              <Text size="xs" c={mine ? 'rgba(255,255,255,0.75)' : 'dimmed'}>
                                {fmtTime(m.created_at)}
                                {mine && <> · {m.optimistic ? '…' : (Array.isArray(m.read_by) && m.read_by.some((id) => Number(id) !== user.id) ? '✓✓' : '✓')}</>}
                              </Text>
                              {mine && !m.optimistic && (
                                <Group gap={4} wrap="nowrap">
                                  <ActionIcon size={16} variant="transparent" color={mine ? '#fff' : 'gray'} onClick={() => { setEditId(m.id); setEditContent(m.content); }} aria-label="Modifier">
                                    <IconPencil size={13} />
                                  </ActionIcon>
                                  <ActionIcon size={16} variant="transparent" color={mine ? '#fff' : 'gray'} onClick={() => deleteMessage(m.id)} aria-label="Supprimer">
                                    <IconTrash size={13} />
                                  </ActionIcon>
                                </Group>
                              )}
                            </Group>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </Stack>
          </ScrollArea.Autosize>

          <Divider />

          <Group px="md" py="sm" gap="sm" align="flex-end" wrap="nowrap">
            <Textarea
              placeholder="Écrire un message..."
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              autosize
              minRows={1}
              maxRows={4}
              disabled={sending}
              style={{ flex: 1 }}
              aria-label="Écrire un message"
            />
            <Tooltip label="Envoyer (Entrée)" position="top" withArrow>
              <ActionIcon
                color="brand"
                size="lg"
                radius="xl"
                variant="filled"
                onClick={send}
                disabled={!draft.trim() || sending}
                aria-label="Envoyer"
              >
                <IconSend size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </>
      )}
    </Paper>
  );

  return (
    <div style={{ height: 'calc(100vh - 140px)', minHeight: 420 }}>
      {isMobile ? (
        activeId ? renderThread : renderList
      ) : (
        <div style={{ display: 'flex', gap: 12, height: '100%' }}>
          <div style={{ width: 320, flexShrink: 0 }}>{renderList}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{renderThread}</div>
        </div>
      )}
      <style>{`
        .msg-item:hover { background: var(--mantine-color-gray-0); }
        [data-mantine-color-scheme='dark'] .msg-item:hover { background: var(--mantine-color-dark-6); }
        .msg-item[data-active] { background: light-dark(var(--mantine-color-brand-0), rgba(63, 163, 74, 0.18)); }
        .msg-bubble { padding: 8px 12px; border-radius: 14px; }
        .msg-mine {
          background: var(--mantine-color-brand-6);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .msg-theirs {
          background: light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5));
          color: light-dark(#1a1a1a, #fff);
          border-bottom-left-radius: 4px;
        }
      `}</style>
    </div>
  );
}