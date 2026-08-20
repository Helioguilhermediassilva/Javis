import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { createOfficialTelegramLinkCode } from "../../server/xavierTelegramOfficial.js";

type Locale = "pt" | "en" | "es";

function localeFromRequest(req: VercelRequest): Locale {
  const raw = typeof req.body?.locale === "string" ? req.body.locale : typeof req.query?.locale === "string" ? req.query.locale : "pt";
  return raw === "en" || raw === "es" ? raw : "pt";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await requireXavierUser(req);
    const link = await createOfficialTelegramLinkCode(user.id, localeFromRequest(req));
    res.status(200).json({ mode: "official", ...link });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) {
      res.status(authError.status).json({ error: authError.message });
      return;
    }
    const message = error instanceof Error ? error.message : "";
    const botConfigurationError = /TELEGRAM_OFFICIAL_BOT_TOKEN|Token do bot oficial Telegram inválido|bot inexistente/i.test(message);
    res.status(botConfigurationError ? 503 : 502).json({
      error: botConfigurationError
        ? "O bot oficial do Telegram ainda não está configurado corretamente no servidor."
        : "Não foi possível preparar a vinculação do Telegram.",
    });
  }
}
