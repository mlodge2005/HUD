"use client";

import { useState, useEffect, useRef } from "react";
import { createAblyClient } from "@/lib/ablyClient";

type AuthUser = { id: string; username: string; displayName: string };

type Message = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; displayName: string };
};

type ListUser = { id: string; displayName: string; role: string; disabled: boolean };

const RATE_LIMIT_MS = 1000;
const BURST = 5;

export default function ChatWidget({ user }: { user: AuthUser }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [usersCollapsed, setUsersCollapsed] = useState(true);
  const [usersList, setUsersList] = useState<ListUser[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSendRef = useRef(0);
  const burstRef = useRef(0);
  const ablyRef = useRef<ReturnType<typeof createAblyClient> | null>(null);

  // Initial messages from DB
  useEffect(() => {
    fetch("/api/chat/messages")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      })
      .catch(() => {});
  }, []);

  // Users list (for "Users online/total" panel)
  useEffect(() => {
    fetch("/api/users/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.users) setUsersList(data.users);
      })
      .catch(() => {});
  }, []);

  // Ably: connect, subscribe to chat, presence enter/leave
  useEffect(() => {
    if (typeof window === "undefined") return;
    const client = createAblyClient();
    ablyRef.current = client;

    const chatChannel = client.channels.get("hud:chat");
    const presenceChannel = client.channels.get("hud:presence");

    chatChannel.subscribe("message", (msg) => {
      const payload = msg.data as Message;
      if (payload?.id) {
        setMessages((prev) => [...prev.slice(-99), payload]);
      }
    });

    const updatePresence = () => {
      presenceChannel.presence.get().then((members) => {
        setOnlineUserIds(new Set(members.map((m) => m.clientId)));
      });
    };

    presenceChannel.presence.subscribe("enter", updatePresence);
    presenceChannel.presence.subscribe("leave", updatePresence);
    presenceChannel.presence.subscribe("update", updatePresence);

    presenceChannel.presence.enter({ displayName: user.displayName }).then(updatePresence);

    return () => {
      presenceChannel.presence.leave().catch(() => {});
      presenceChannel.presence.unsubscribe();
      chatChannel.unsubscribe();
      client.close();
      ablyRef.current = null;
    };
  }, [user.displayName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const now = Date.now();
    if (now - lastSendRef.current >= RATE_LIMIT_MS) burstRef.current = 0;
    burstRef.current += 1;
    if (burstRef.current > BURST) return;
    lastSendRef.current = now;

    fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setMessages((prev) => [...prev.slice(-99), data]);
          setInput("");
        }
      })
      .catch(() => {});
  }

  const onlineCount = onlineUserIds.size;
  const totalCount = usersList.length;

  return (
    <div className="bg-black/60 text-white rounded-lg overflow-hidden flex flex-col max-h-96 w-80">
      {/* Users Online — collapsible above chat */}
      <div>
        <button
          type="button"
          onClick={() => setUsersCollapsed(!usersCollapsed)}
          className="w-full p-2 text-left font-medium text-sm flex justify-between items-center"
        >
          <span>Users ({onlineCount}/{totalCount})</span>
          <span>{usersCollapsed ? "▼" : "▲"}</span>
        </button>
        {!usersCollapsed && (
          <div className="max-h-32 overflow-y-auto p-2 border-b border-white/20 space-y-1">
            {usersList.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    onlineUserIds.has(u.id) ? "bg-green-500" : "bg-gray-500"
                  }`}
                  title={onlineUserIds.has(u.id) ? "Online" : "Offline"}
                />
                <span className="truncate">{u.displayName}</span>
                {u.disabled && <span className="text-gray-500 text-xs">(disabled)</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <button
        type="button"
        onClick={() => setChatCollapsed(!chatCollapsed)}
        className="p-2 text-left font-medium text-sm flex justify-between"
      >
        Chat
        <span>{chatCollapsed ? "▼" : "▲"}</span>
      </button>
      {!chatCollapsed && (
        <>
          <div className="overflow-y-auto flex-1 p-2 space-y-1 min-h-24 max-h-48">
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="text-gray-400">{m.user.displayName}:</span> {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-2 flex gap-2 border-t border-white/20">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message…"
              className="flex-1 bg-white/10 rounded px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={send}
              className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
