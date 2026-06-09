import { useEffect, useMemo, useState } from "react";
import {
  createDirectConversation,
  fetchConversationDetail,
  fetchConversations,
  searchUsers,
  sendMessage,
} from "../api/chat";
import { ChatWindow } from "../components/ChatWindow";
import { useRealtimeMessages } from "../hooks/useRealtimeMessages";
import type {
  ConversationDetail,
  ConversationSummary,
  MessageCreatedEvent,
  MessageDto,
  SessionUser,
  UiConversation,
  UiMessage,
  UserSummary,
} from "../types";
import "./Dashboard.css";

interface Props {
  user: SessionUser;
  onLogout: () => void;
}

function formatConversation(conversation: ConversationSummary): UiConversation {
  return {
    conversationId: conversation.conversation_id,
    contact: conversation.other_participant,
    lastMessage: conversation.last_message?.content ?? "Sin mensajes todavía",
    lastMessageLabel: conversation.last_message?.classification_label ?? null,
    lastMessageAt: conversation.last_message?.created_at ?? null,
    unreadCount: 0,
  };
}

function formatMessage(message: MessageDto, currentUserId: number): UiMessage {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    direction: message.sender_id === currentUserId ? "me" : "other",
    content: message.content,
    classificationLabel: message.classification_label,
    createdAt: message.created_at,
  };
}

export function Dashboard({ user, onLogout }: Props) {
  const [conversations, setConversations] = useState<UiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [activeConversationDetail, setActiveConversationDetail] = useState<ConversationDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [sidebarError, setSidebarError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const activeMessages = useMemo(() => {
    if (!activeConversationDetail) {
      return [];
    }
    return activeConversationDetail.messages.map((message) => formatMessage(message, user.id));
  }, [activeConversationDetail, user.id]);

  const upsertConversation = (conversationSummary: ConversationSummary, incrementUnread: boolean) => {
    const formattedConversation = formatConversation(conversationSummary);
    setConversations((previousConversations) => {
      const existingConversation = previousConversations.find(
        (conversation) => conversation.conversationId === formattedConversation.conversationId
      );

      const nextUnreadCount =
        incrementUnread && activeConversationId !== formattedConversation.conversationId
          ? (existingConversation?.unreadCount ?? 0) + 1
          : activeConversationId === formattedConversation.conversationId
            ? 0
            : existingConversation?.unreadCount ?? 0;

      const mergedConversation: UiConversation = {
        ...formattedConversation,
        unreadCount: nextUnreadCount,
      };

      const remainingConversations = previousConversations.filter(
        (conversation) => conversation.conversationId !== formattedConversation.conversationId
      );
      return [mergedConversation, ...remainingConversations];
    });
  };

  const loadConversations = async () => {
    try {
      setSidebarError("");
      const response = await fetchConversations(user.token);
      setConversations((previousConversations) =>
        response.conversations.map((conversation) => {
          const existingConversation = previousConversations.find(
            (item) => item.conversationId === conversation.conversation_id
          );
          return {
            ...formatConversation(conversation),
            unreadCount:
              existingConversation && existingConversation.conversationId !== activeConversationId
                ? existingConversation.unreadCount
                : 0,
          };
        })
      );
      if (activeConversationId === null && response.conversations.length > 0) {
        setActiveConversationId(response.conversations[0].conversation_id);
      }
    } catch (requestError) {
      setSidebarError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las conversaciones.");
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadConversationDetail = async (conversationId: number) => {
    try {
      setDetailError("");
      setIsLoadingMessages(true);
      const response = await fetchConversationDetail(user.token, conversationId);
      setActiveConversationDetail(response);
      setConversations((previousConversations) =>
        previousConversations.map((conversation) =>
          conversation.conversationId === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los mensajes.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    void loadConversations();
    const conversationsInterval = window.setInterval(() => {
      void loadConversations();
    }, 15000);

    return () => {
      window.clearInterval(conversationsInterval);
    };
  }, [user.token]);

  useEffect(() => {
    if (activeConversationId === null) {
      setActiveConversationDetail(null);
      return;
    }
    void loadConversationDetail(activeConversationId);
  }, [activeConversationId, user.token]);

  useEffect(() => {
    if (!showSearchPanel || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchUsers(user.token, searchQuery.trim());
        setSearchResults(response.users);
      } catch {
        setSearchResults([]);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery, showSearchPanel, user.token]);

  useRealtimeMessages({
    token: user.token,
    onMessageCreated: (event: MessageCreatedEvent) => {
      upsertConversation(
        {
          conversation_id: event.conversation_id,
          other_participant: event.sender,
          last_message: event.message,
        },
        true
      );

      if (event.conversation_id === activeConversationId) {
        setActiveConversationDetail((previousDetail) => {
          if (!previousDetail || previousDetail.conversation_id !== event.conversation_id) {
            return previousDetail;
          }
          const messageAlreadyExists = previousDetail.messages.some((message) => message.id === event.message.id);
          if (messageAlreadyExists) {
            return previousDetail;
          }
          return {
            ...previousDetail,
            messages: [...previousDetail.messages, event.message],
          };
        });
      }
    },
  });

  const handleSelectConversation = (conversationId: number) => {
    setActiveConversationId(conversationId);
    setShowSearchPanel(false);
  };

  const handleCreateConversation = async (targetUserId: number) => {
    try {
      setIsCreatingConversation(true);
      const response = await createDirectConversation(user.token, targetUserId);
      upsertConversation(response.conversation, false);
      setActiveConversationId(response.conversation.conversation_id);
      setShowSearchPanel(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (requestError) {
      setSidebarError(requestError instanceof Error ? requestError.message : "No se pudo crear la conversación.");
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (activeConversationId === null) {
      return;
    }

    const response = await sendMessage(user.token, {
      conversation_id: activeConversationId,
      content,
    });

    setActiveConversationDetail((previousDetail) => {
      if (!previousDetail || previousDetail.conversation_id !== activeConversationId) {
        return previousDetail;
      }
      return {
        ...previousDetail,
        messages: [...previousDetail.messages, response.message],
      };
    });

    setConversations((previousConversations) =>
      [
        ...previousConversations
          .map((conversation) =>
            conversation.conversationId === activeConversationId
              ? {
                  ...conversation,
                  lastMessage: response.message.content,
                  lastMessageLabel: response.message.classification_label,
                  lastMessageAt: response.message.created_at,
                }
              : conversation
          )
          .filter((conversation) => conversation.conversationId === activeConversationId),
        ...previousConversations.filter((conversation) => conversation.conversationId !== activeConversationId),
      ]
    );
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar__header">
          <div>
            <p className="sidebar__title">ITChat</p>
            <p className="sidebar__email">@{user.username}</p>
          </div>
          <button className="sidebar__logout" onClick={() => setShowLogoutModal(true)} title="Cerrar sesión">
            ↩
          </button>
        </div>

        <div className="sidebar__search">
          <div className="sidebar__search-row">
            <input
              className="sidebar__search-input"
              placeholder="Buscar usuario..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setShowSearchPanel(true)}
            />
            <button
              className="sidebar__new-chat-btn"
              type="button"
              onClick={() => setShowSearchPanel((currentValue) => !currentValue)}
            >
              Nuevo mensaje
            </button>
          </div>
          {showSearchPanel && (
            <div className="sidebar__search-results">
              {searchQuery.trim().length < 2 && (
                <p className="sidebar__search-hint">Escribe al menos 2 caracteres para buscar usuarios.</p>
              )}
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  className="sidebar__search-result"
                  type="button"
                  onClick={() => void handleCreateConversation(result.id)}
                  disabled={isCreatingConversation}
                >
                  <span className="sidebar__search-result-name">{result.username}</span>
                  <span className="sidebar__search-result-action">Abrir chat</span>
                </button>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="sidebar__search-hint">No se encontraron usuarios.</p>
              )}
            </div>
          )}
          {sidebarError && <p className="sidebar__error">{sidebarError}</p>}
        </div>

        <ul className="chat-list">
          {isLoadingConversations && <li className="chat-list__empty">Cargando conversaciones...</li>}
          {!isLoadingConversations && conversations.length === 0 && (
            <li className="chat-list__empty">Todavía no tienes conversaciones.</li>
          )}
          {conversations.map((conversation) => (
            <li
              key={conversation.conversationId}
              className={`chat-list__item ${activeConversationId === conversation.conversationId ? "chat-list__item--active" : ""}`}
              onClick={() => handleSelectConversation(conversation.conversationId)}
            >
              <div className="chat-list__avatar">
                {conversation.contact.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="chat-list__info">
                <p className="chat-list__name">{conversation.contact.username}</p>
                <p className="chat-list__last">{conversation.lastMessage}</p>
              </div>
              {conversation.unreadCount > 0 && (
                <span className="chat-list__badge">{conversation.unreadCount}</span>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <main className="main-area">
        {activeConversation ? (
          <ChatWindow
            key={activeConversation.conversationId}
            conversation={activeConversation}
            messages={activeMessages}
            currentUser={user}
            isLoadingMessages={isLoadingMessages}
            error={detailError}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="main-empty">
            <span className="main-empty__icon">🛡️</span>
            <p className="main-empty__title">Selecciona un chat</p>
            <p className="main-empty__sub">
              Busca un usuario y abre una conversación para empezar a enviar mensajes.
            </p>
          </div>
        )}
      </main>
      {showLogoutModal && (
        <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal__title">¿Cerrar sesión?</p>
            <p className="modal__body">¿Seguro que quieres salir de la sesión?</p>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--cancel" onClick={() => setShowLogoutModal(false)}>
                Cancelar
              </button>
              <button className="modal__btn modal__btn--confirm" onClick={onLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
