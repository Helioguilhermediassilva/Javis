import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../../server/xavierAuth.js";
import {
  createXavierCrmNote,
  deleteXavierCrmNote,
  listXavierCrmNotes,
  updateXavierCrmNote,
  type XavierCrmNoteInput,
  XavierCrmValidationError,
} from "../../../server/xavierCrm.js";

async function readBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk.toString(); });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw) as Record<string, unknown>); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function queryValue(req: VercelRequest, key: string): string {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] || "" : typeof value === "string" ? value : "";
}

function requireId(req: VercelRequest): string {
  const id = queryValue(req, "id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new XavierCrmValidationError("id da anotação inválido");
  }
  return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await requireXavierUser(req);
    if (req.method === "GET") {
      res.status(200).json({ notes: await listXavierCrmNotes(user.id) });
      return;
    }
    if (req.method === "POST") {
      const note = await createXavierCrmNote(user.id, await readBody(req) as XavierCrmNoteInput);
      res.status(201).json({ note });
      return;
    }
    const id = requireId(req);
    if (req.method === "PATCH") {
      const note = await updateXavierCrmNote(user.id, id, await readBody(req) as XavierCrmNoteInput);
      res.status(200).json({ note });
      return;
    }
    await deleteXavierCrmNote(user.id, id);
    res.status(204).end();
  } catch (error) {
    const authError = authErrorResponse(error);
    const validation = error instanceof XavierCrmValidationError;
    res.status(authError?.status || (validation ? 400 : 502)).json({
      error: authError?.message || (error as Error).message || "Não foi possível acessar as anotações",
    });
  }
}
