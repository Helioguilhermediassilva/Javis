import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleJarvisChat } from "../../server/jarvisProxy";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // VercelRequest/Response são compatíveis com IncomingMessage/ServerResponse
  await handleJarvisChat(req as never, res as never);
}
