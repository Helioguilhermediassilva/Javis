import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { getXavierProfile, updateXavierProfile } from "../../server/xavierMemory.js";

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
  if (req.method !== "GET" && req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await requireXavierUser(req);
    if (req.method === "GET") return res.status(200).json({ profile: await getXavierProfile(user.id) });
    const body = await readBody(req);
    const profile = await updateXavierProfile(user.id, {
      display_name: typeof body.display_name === "string" ? body.display_name : undefined,
      memory_enabled: typeof body.memory_enabled === "boolean" ? body.memory_enabled : undefined,
      retention_days: typeof body.retention_days === "number" ? body.retention_days : undefined,
      monthly_message_limit: typeof body.monthly_message_limit === "number" ? body.monthly_message_limit : undefined,
    });
    return res.status(200).json({ profile });
  } catch (error) {
    const authError = authErrorResponse(error);
    return res.status(authError?.status || 502).json({ error: authError?.message || (error as Error).message || "Não foi possível carregar as preferências" });
  }
}
