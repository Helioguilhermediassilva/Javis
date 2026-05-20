import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDfTopics } from "../../server/dfDataProxy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Debug embutido: ?diag=1 reporta env vars e git sha do deploy ativo
  const url = req.url || "";
  if (url.includes("diag=1")) {
    const keys = ["XAI_API_KEY", "XAI_API_URL", "LLM_API_KEY", "LLM_API_URL", "ELEVENLABS_API_KEY"];
    const env: Record<string, { present: boolean; length: number; preview: string }> = {};
    for (const k of keys) {
      const v = process.env[k] || "";
      env[k] = { present: v.length > 0, length: v.length, preview: v.length > 0 ? `${v.slice(0, 4)}...${v.slice(-2)}` : "" };
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      git_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      git_msg: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      deployment: process.env.VERCEL_DEPLOYMENT_ID || null,
      env,
      ts: new Date().toISOString(),
    });
    return;
  }
  await handleDfTopics(req as never, res as never);
}
