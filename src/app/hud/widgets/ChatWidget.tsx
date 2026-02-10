"use client";

import { useState, useEffect, useRef } from "react";
import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { encodeRTMessage, decodeRTMessage, type RTChat } from "@/lib/realtime";

type AuthUser = { id: string; username: string; displayName: string };

type Message = {
  messageId: string;
  userId: string;
  username: string;
  text: string;
  ts: string;
};

const RATE_LIMIT_MS = 1000;
const BURST = 5;

export default function ChatWidget({
  room,
  user,
}: {
  room: Room | null;
  user: AuthUser;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSendRef = useRef(0);
  const burstRef = useRef(0);

  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array) => {
      const msg = decodeRTMessage(payload);
      if (msg?.type === "chat") {
        const m = msg as RTChat;
        setMessages((prev) => [...prev.slice(-99), { messageId: m.messageId, userId: m.userId, username: m.username, text: m.text, ts: m.ts }]);
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || !room) return;
    const now = Date.now();
    if (now - lastSendRef.current >= RATE_LIMIT_MS) burstRef.current = 0;
    burstRef.current += 1;
    if (burstRef.current > BURST) return;
    lastSendRef.current = now;
    const msg: RTChat = {
      type: "chat",
      messageId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      userId: user.id,
      username: user.displayName,
      text,
      ts: new Date().toISOString(),
    };
    const data = encodeRTMessage(msg);
    room.localParticipant.publishData(data, { reliable: true }).catch(() => {});
    setMessages((prev) => [...prev.slice(-99), { messageId: msg.messageId, userId: msg.userId, username: msg.username, text: msg.text, ts: msg.ts }]);
    setInput("");
  }

  return (
    <div className="bg-black/60 text-white rounded-lg overflow-hidden flex flex-col max-h-64">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 text-left font-medium text-sm flex justify-between"
      >
        Chat
        <span>{collapsed ? "▼" : "▲"}</span>
      </button>
      {!collapsed && (
        <>
          <div className="overflow-y-auto flex-1 p-2 space-y-1 min-h-32 max-h-48">
            {messages.map((m) => (
              <div key={m.messageId} className="text-sm">
                <span className="text-gray-400">{m.username}:</span> {m.text}
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
