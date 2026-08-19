import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import { deleteXavierUserData, getXavierProfile, listXavierSummaries } from "../../server/xavierMemory.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, DELETE");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await requireXavierUser(req);
    if (req.method === "GET") {
      const [profile, summaries] = await Promise.all([
        getXavierProfile(user.id),
        listXavierSummaries(user.id),
      ]);
      res.status(200).json({
        profile: {
          memory_enabled: profile.memory_enabled,
          retention_days: profile.retention_days,
          monthly_message_limit: profile.monthly_message_limit,
        },
        summaries: summaries.map((item) => ({
          id: item.id,
          conversation_id: item.conversation_id,
          summary: item.summary,
          source_message_count: item.source_message_count,
          pinned: item.pinned,
          updated_at: item.updated_at,
        })),
      });
      return;
    }
    await deleteXavierUserData(user.id);
    res.status(200).json({ ok: true, message: "Memória e dados da conta apagados." });
  } catch (error) {
    const authError = authErrorResponse(error);
    res.status(authError?.status || 502).json({
      error: authError?.message || (error as Error).message || "Não foi possível acessar a memória do Xavier",
    });
  }
}
