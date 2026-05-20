import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDfDataset } from "../../server/dfDataProxy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleDfDataset(req as never, res as never);
}
