import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleGrokSentiment } from "../../server/grokProxy.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleGrokSentiment(req as never, res as never);
}
