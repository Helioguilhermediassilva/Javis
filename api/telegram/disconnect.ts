import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { disconnectXavierTelegram } from "../../server/xavierTelegram.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await requireXavierUser(req);
    await disconnectXavierTelegram(user.id);
    return res.status(200).json({ connected: false });
  } catch (error) {
    const authError = authErrorResponse(error);
    return res.status(authError?.status || 502).json({ error: authError?.message || (error as Error).message || "Não foi possível desconectar o Telegram" });
  }
}
