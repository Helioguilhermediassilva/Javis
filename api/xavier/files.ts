import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { ensureXavierConversation } from "../../server/xavierMemory.js";
import {
  createXavierFileUpload,
  fileDownloadUrl,
  finalizeXavierFile,
  listXavierFiles,
} from "../../server/xavierFiles.js";

function bodyOf(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function queryValue(req: VercelRequest, name: string): string {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] || "" : typeof value === "string" ? value : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!["GET", "POST", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, PATCH");
    res.status(405).json({ error: "Método não permitido" });
    return;
  }

  try {
    const user = await requireXavierUser(req);
    const conversation = await ensureXavierConversation({ userId: user.id, channel: "web", title: "Cockpit web" });

    if (req.method === "GET") {
      const requestedFileId = queryValue(req, "file_id");
      if (requestedFileId) {
        res.status(200).json(await fileDownloadUrl(user.id, conversation.id, requestedFileId));
      } else {
        res.status(200).json({ files: await listXavierFiles(user.id, conversation.id) });
      }
      return;
    }

    const body = bodyOf(req);
    if (req.method === "POST") {
      const fileName = typeof body.file_name === "string" ? body.file_name : "";
      const mimeType = typeof body.mime_type === "string" ? body.mime_type : "application/octet-stream";
      const sizeBytes = typeof body.size_bytes === "number" ? body.size_bytes : Number(body.size_bytes);
      if (!fileName.trim() || !Number.isFinite(sizeBytes)) {
        res.status(400).json({ error: "file_name e size_bytes são obrigatórios" });
        return;
      }
      const upload = await createXavierFileUpload({
        userId: user.id,
        conversation,
        fileName,
        mimeType,
        sizeBytes,
      });
      res.status(201).json({
        file: upload.file,
        upload: {
          url: upload.upload_url,
          token: upload.upload_token,
          path: upload.upload_path,
        },
      });
      return;
    }

    const fileId = typeof body.file_id === "string" ? body.file_id : queryValue(req, "file_id");
    const status = body.status === "failed" ? "failed" : body.status === "ready" ? "ready" : "";
    if (!fileId || !status) {
      res.status(400).json({ error: "file_id e status válido são obrigatórios" });
      return;
    }
    const file = await finalizeXavierFile({
      userId: user.id,
      conversationId: conversation.id,
      fileId,
      status,
    });
    res.status(200).json({ file });
  } catch (error) {
    const authError = authErrorResponse(error);
    res.status(authError?.status || 502).json({
      error: authError?.message || (error as Error).message || "Não foi possível acessar os arquivos da sessão",
    });
  }
}
