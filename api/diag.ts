import type { VercelRequest, VercelResponse } from "@vercel/node";

// Rota de diagnóstico: reporta presença/tamanho de variáveis sensíveis
// sem revelar o valor. Útil para debugar deploys.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const keys = [
    "XAI_API_KEY",
    "XAI_API_URL",
    "LLM_API_KEY",
    "LLM_API_URL",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
  ];
  const presence: Record<string, { present: boolean; length: number; preview: string }> = {};
  for (const k of keys) {
    const v = process.env[k] || "";
    presence[k] = {
      present: v.length > 0,
      length: v.length,
      preview: v.length > 0 ? `${v.slice(0, 4)}...${v.slice(-2)}` : "",
    };
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    node: process.version,
    region: process.env.VERCEL_REGION || null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID || null,
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    env: presence,
    ts: new Date().toISOString(),
  });
}
