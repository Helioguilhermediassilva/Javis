import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { unlinkOfficialTelegram } from "../../server/xavierTelegramOfficial.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await requireXavierUser(req);
    await unlinkOfficialTelegram(user.id);
    res.status(200).json({ connected: false, mode: "official" });
  } catch (error) {
    const authError = authErrorResponse(error);
    res.status(authError?.status || 502).json({ error: authError?.message || "Não foi possível desvincular o Telegram." });
  }
}
