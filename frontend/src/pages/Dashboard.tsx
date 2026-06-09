import { useState } from "react";
import { ChatWindow } from "../components/ChatWindow";
import type { Chat, Message, User } from "../types";
import "./Dashboard.css";

// Sample chats for development — replace with real data from your API
const DEMO_CHATS: Chat[] = [
  { id: "1", contact: "Jorge Méndez", avatar: "👨‍💼", lastMessage: "Hola, ¿todo bien?", unread: 0, messages: [] },
  { id: "2", contact: "Banco Nacional", avatar: "🏦", lastMessage: "Verificación requerida", unread: 2, messages: [] },
  { id: "3", contact: "Octavio R.", avatar: "🧑‍🏫", lastMessage: "Revisa el repo", unread: 0, messages: [] },
  { id: "4", contact: "Promo Outlet", avatar: "📢", lastMessage: "¡GANA $5,000!", unread: 1, messages: [] },
];

interface Props {
  user: User;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: Props) {
  const [chats, setChats] = useState<Chat[]>(DEMO_CHATS);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const handleUpdateChat = (chatId: string, message: Message) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;

        // If message already exists (label update), replace it
        const exists = chat.messages.some((m) => m.id === message.id);
        const messages = exists
          ? chat.messages.map((m) => (m.id === message.id ? message : m))
          : [...chat.messages, message];

        return { ...chat, messages, lastMessage: message.text };
      })
    );
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div>
            <p className="sidebar__title">ITChat</p>
            <p className="sidebar__email">{user.email}</p>
          </div>
          <button className="sidebar__logout" onClick={() => setShowLogoutModal(true)} title="Cerrar sesión">
            ↩
          </button>
        </div>

        <div className="sidebar__search">
          <input className="sidebar__search-input" placeholder="Buscar chat…" readOnly />
        </div>

        <ul className="chat-list">
          {chats.map((chat) => (
            <li
              key={chat.id}
              className={`chat-list__item ${activeChatId === chat.id ? "chat-list__item--active" : ""}`}
              onClick={() => setActiveChatId(chat.id)}
            >
              <div className="chat-list__avatar">{chat.avatar}</div>
              <div className="chat-list__info">
                <p className="chat-list__name">{chat.contact}</p>
                <p className="chat-list__last">{chat.lastMessage}</p>
              </div>
              {chat.unread > 0 && (
                <span className="chat-list__badge">{chat.unread}</span>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main area */}
      <main className="main-area">
        {activeChat ? (
          <ChatWindow
            key={activeChat.id}
            chat={activeChat}
            token={user.token}
            onUpdateChat={handleUpdateChat}
          />
        ) : (
          <div className="main-empty">
            <span className="main-empty__icon">🛡️</span>
            <p className="main-empty__title">Selecciona un chat</p>
            <p className="main-empty__sub">
              Cada mensaje recibido será analizado automáticamente por el modelo de IA.
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
