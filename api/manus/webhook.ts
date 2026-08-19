import type { IncomingMessage } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyManusWebhookEvent,
  buildManusResultText,
  isPdfTaskRequest,
  markManusTaskDelivered,
  persistManusTaskAttachments,
  verifyManusWebhookSignature,
} from "../../server/xavierManus.js";
import {
  getStoredXavierTelegramConnection,
  sendXavierTelegramDocument,
  sendXavierTelegramMessage,
} from "../../server/xavierTelegram.js";
import { createXavierPdfAttachment } from "../../server/xavierPdf.js";
import { appendXavierMessage } from "../../server/xavierMemory.js";

export const config = {
  api: { bodyParser: false },
  maxDuration: 10,
};

function header(req: VercelRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function requestUrl(req: VercelRequest): string {
  if (process.env.MANUS_WEBHOOK_URL) return process.env.MANUS_WEBHOOK_URL;
  const protocol = header(req, "x-forwarded-proto") || "https";
  const host = header(req, "x-forwarded-host") || header(req, "host");
  return `${protocol}://${host}${req.url || "/api/manus/webhook"}`;
}

function isManusVerificationProbe(rawBody: string): boolean {
  if (!rawBody.trim()) return true;
  try {
    const payload = JSON.parse(rawBody) as unknown;
    if (!payload || typeof payload !== "object") return false;
    const record = payload as Record<string, unknown>;
    const eventType = typeof record.event_type === "string" ? record.event_type.toLowerCase() : "";
    if (["test", "webhook_test", "verification", "ping"].includes(eventType)) return true;
    return record.event_type === undefined && record.task_detail === undefined;
  } catch {
    return false;
  }
}

async function deliverTelegramResult(task: Awaited<ReturnType<typeof applyManusWebhookEvent>>): Promise<void> {
  if (!task || task.channel !== "telegram" || task.status === "running" || task.delivered_at) return;
  if (!task.telegram_connection_id || !task.telegram_chat_id) return;
  const connection = await getStoredXavierTelegramConnection(task.telegram_connection_id);
  if (!connection || connection.status !== "active") {
    console.warn("[manus-webhook] Telegram connection unavailable", task.telegram_connection_id);
    return;
  }
  let taskForDelivery = task;
  if (task.status === "completed" && !task.attachments?.length && isPdfTaskRequest(task.request_text) && task.result_text?.trim()) {
    try {
      const fallbackAttachment = await createXavierPdfAttachment({
        userId: task.user_id,
        taskId: `${task.id}-local-pdf`,
        title: "Documento gerado pelo Xavier",
        body: task.result_text,
      });
      const attachments = [fallbackAttachment];
      await persistManusTaskAttachments(task.user_id, task.id, attachments);
      taskForDelivery = { ...task, attachments };
      console.warn("[manus-webhook] local PDF fallback created", task.id);
    } catch (error) {
      console.warn("[manus-webhook] local PDF fallback failed", task.id, (error as Error).message);
    }
  }
  const result = buildManusResultText(taskForDelivery);
  await sendXavierTelegramMessage(connection, task.telegram_chat_id, result);
  for (const attachment of taskForDelivery.attachments || []) {
    try {
      await sendXavierTelegramDocument(connection, task.telegram_chat_id, attachment.url, `Arquivo gerado pelo Xavier: ${attachment.file_name}`);
    } catch (error) {
      // O link HTTPS continua no texto para que a entrega da tarefa não seja perdida
      // caso o Telegram não consiga buscar o arquivo remoto.
      console.warn("[manus-webhook] document delivery failed", attachment.file_name, (error as Error).message);
    }
  }
  if (task.conversation_id) {
    await appendXavierMessage({
      userId: task.user_id,
      conversationId: task.conversation_id,
      channel: "telegram",
      role: "assistant",
      content: result,
    });
  }
  await markManusTaskDelivered(task.user_id, task.id);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "HEAD") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS, POST");
    res.status(200).end();
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({ ok: true, verification: true });
    return;
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS, POST");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const rawBody = await readRawBody(req as IncomingMessage);
    if (!header(req, "x-webhook-signature") && isManusVerificationProbe(rawBody)) {
      res.status(200).json({ ok: true, verification: true });
      return;
    }
    const signature = header(req, "x-webhook-signature");
    const timestamp = header(req, "x-webhook-timestamp");
    const valid = await verifyManusWebhookSignature(rawBody, signature, timestamp, requestUrl(req));
    if (!valid) {
      res.status(401).json({ error: "Invalid Manus webhook signature" });
      return;
    }
    let event: Parameters<typeof applyManusWebhookEvent>[0];
    try {
      event = JSON.parse(rawBody) as Parameters<typeof applyManusWebhookEvent>[0];
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }
    const task = await applyManusWebhookEvent(event);
    if (event.event_type === "task_stopped") {
      await deliverTelegramResult(task);
    }
    res.status(200).json({ ok: true, handled: Boolean(task), event_type: event.event_type || null });
  } catch (error) {
    console.error("[manus-webhook] failed", (error as Error).message);
    res.status(500).json({ error: "Manus webhook processing failed" });
  }
}
