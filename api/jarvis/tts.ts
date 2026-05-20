import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleJarvisTts } from "../../server/jarvisProxy.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleJarvisTts(req as never, res as never);
}
