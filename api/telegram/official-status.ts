import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { getOfficialTelegramStatus } from "../../server/xavierTelegramOfficial.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await requireXavierUser(req);
    res.status(200).json(await getOfficialTelegramStatus(user.id));
  } catch (error) {
    const authError = authErrorResponse(error);
    res.status(authError?.status || 502).json({ error: authError?.message || "Não foi possível consultar o vínculo do Telegram." });
  }
}
