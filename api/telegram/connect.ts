import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { connectXavierTelegram } from "../../server/xavierTelegram.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await requireXavierUser(req);
    const body = await readBody(req);
    const botToken = typeof body.botToken === "string" ? body.botToken : "";
    if (!botToken.trim()) return res.status(400).json({ error: "botToken é obrigatório" });
    const connection = await connectXavierTelegram(user.id, botToken);
    return res.status(200).json({ connected: true, connection });
  } catch (error) {
    const authError = authErrorResponse(error);
    const status = authError?.status || 502;
    return res.status(status).json({ error: authError?.message || (error as Error).message || "Não foi possível conectar o Telegram" });
  }
}
