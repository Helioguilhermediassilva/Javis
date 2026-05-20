import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDfSearch } from "../../server/dfDataProxy";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleDfSearch(req as never, res as never);
}
