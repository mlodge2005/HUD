import { z } from "zod";

export const rtChatSchema = z.object({
  type: z.literal("chat"),
  messageId: z.string(),
  userId: z.string(),
  username: z.string(),
  text: z.string(),
  ts: z.string(),
});
export type RTChat = z.infer<typeof rtChatSchema>;

export const rtStreamStatusSchema = z.object({
  type: z.literal("stream:status"),
  activeStreamerUserId: z.string().nullable(),
  isLive: z.boolean(),
  liveStartedAt: z.string().nullable(),
  ts: z.number(),
});
export type RTStreamStatus = z.infer<typeof rtStreamStatusSchema>;

export const rtStreamRequestSchema = z.object({
  type: z.literal("stream:request"),
  fromUserId: z.string(),
  fromUsername: z.string(),
  ts: z.number(),
});
export type RTStreamRequest = z.infer<typeof rtStreamRequestSchema>;

export const rtStreamRequestResponseSchema = z.object({
  type: z.literal("stream:request:response"),
  accepted: z.boolean(),
  toUserId: z.string(),
  ts: z.number(),
});
export type RTStreamRequestResponse = z.infer<typeof rtStreamRequestResponseSchema>;

export const rtStreamHandoffSchema = z.object({
  type: z.literal("stream:handoff"),
  newStreamerUserId: z.string(),
  ts: z.number(),
});
export type RTStreamHandoff = z.infer<typeof rtStreamHandoffSchema>;

export const rtMessageSchema = z.discriminatedUnion("type", [
  rtChatSchema,
  rtStreamStatusSchema,
  rtStreamRequestSchema,
  rtStreamRequestResponseSchema,
  rtStreamHandoffSchema,
]);
export type RTMessage =
  | RTChat
  | RTStreamStatus
  | RTStreamRequest
  | RTStreamRequestResponse
  | RTStreamHandoff;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeRTMessage(msg: RTMessage): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

export function decodeRTMessage(data: Uint8Array): RTMessage | null {
  try {
    const parsed = JSON.parse(decoder.decode(data)) as unknown;
    return rtMessageSchema.parse(parsed) as RTMessage;
  } catch {
    return null;
  }
}
