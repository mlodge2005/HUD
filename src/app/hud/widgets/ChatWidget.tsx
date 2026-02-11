"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type AuthUser = { id: string; username: string; displayName: string; role: string };

type Message = {
  id: string;
  text: string;
  createdAt: string;
  authorDisplayName?: string;
  user: { id: string; displayName: string };
};

type OnlineUser = { userId: string; displayName: string; role: string };

const RATE_LIMIT_MS = 1000;
const BURST = 5;
const CHANNEL_NAME = "hud-global";

export default function ChatWidget({ user }: { user: AuthUser }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [usersCollapsed, setUsersCollapsed] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSendRef = useRef(0);
  const burstRef = useRef(0);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial messages from DB
  useEffect(() => {
    fetch("/api/chat/messages?limit=50", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
          data.messages.forEach((m: Message) => messageIdsRef.current.add(m.id));
        }
      })
      .catch(() => {});
  }, []);

  // Supabase Realtime: presence + broadcast
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    const supabase = createSupabaseClient();
    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: { key: user.id },
        broadcast: { self: true },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ userId?: string; displayName?: string; role?: string }>>;
        const list: OnlineUser[] = [];
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            if (p?.userId && p?.displayName) {
              list.push({
                userId: p.userId,
                displayName: p.displayName,
                role: p.role ?? "user",
              });
            }
          });
        });
        setOnlineUsers(list);
      })
      .on("broadcast", { event: "chat:message" }, ({ payload }) => {
        const msg = payload as Message;
        if (!msg?.id || messageIdsRef.current.has(msg.id)) return;
        messageIdsRef.current.add(msg.id);
        setMessages((prev) => [...prev.slice(-99), msg]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            displayName: user.displayName,
            role: user.role,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user.id, user.displayName, user.role]);

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
      credentials: "include",
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          const message: Message = {
            id: data.id,
            text: data.text,
            createdAt: data.createdAt,
            authorDisplayName: data.authorDisplayName ?? data.user?.displayName,
            user: data.user ?? { id: user.id, displayName: user.displayName },
          };
          messageIdsRef.current.add(message.id);
          setMessages((prev) => [...prev.slice(-99), message]);
          setInput("");
          const ch = channelRef.current;
          if (ch) {
            ch.send({ type: "broadcast", event: "chat:message", payload: message });
          }
        }
      })
      .catch(() => {});
  }

  const displayName = (m: Message) => m.authorDisplayName ?? m.user?.displayName ?? "?";

  return (
    <div className="h-full max-h-full overflow-hidden flex flex-col bg-black/60 text-white rounded-lg w-80">
      {/* Online Users — collapsible above chat */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => setUsersCollapsed(!usersCollapsed)}
          className="w-full p-2 text-left font-medium text-sm flex justify-between items-center"
        >
          <span>Online ({onlineUsers.length})</span>
          <span>{usersCollapsed ? "▼" : "▲"}</span>
        </button>
        {!usersCollapsed && (
          <div className="max-h-32 overflow-y-auto p-2 border-b border-white/20 space-y-1">
            {onlineUsers.map((u) => (
              <div key={u.userId} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0 bg-green-500" title="Online" />
                <span className="truncate">{u.displayName}</span>
                {u.role === "admin" && (
                  <span className="shrink-0 text-xs bg-amber-600 px-1 rounded">ADMIN</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <button
        type="button"
        onClick={() => setChatCollapsed(!chatCollapsed)}
        className="shrink-0 p-2 text-left font-medium text-sm flex justify-between"
      >
        Chat
        <span>{chatCollapsed ? "▼" : "▲"}</span>
      </button>
      {!chatCollapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="text-gray-400">{displayName(m)}</span>
                <span className="text-gray-500 text-xs ml-1">
                  {new Date(m.createdAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <br />
                <span>{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0 p-2 flex gap-2 border-t border-white/20">
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
