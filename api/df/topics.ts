import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDfTopics } from "../../server/dfDataProxy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleDfTopics(req as never, res as never);
}
