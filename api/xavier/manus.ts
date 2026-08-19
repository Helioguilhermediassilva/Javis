import { authErrorResponse, requireXavierUser } from "../../server/xavierAuth.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getXavierManusTask,
  listXavierManusTasks,
  sendManusTaskMessage,
} from "../../server/xavierManus.js";

function bodyOf(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function queryValue(req: VercelRequest, name: string): string {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] || "" : typeof value === "string" ? value : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await requireXavierUser(req);
    if (req.method === "GET") {
      const taskId = queryValue(req, "task_id");
      if (taskId) {
        const task = await getXavierManusTask(user.id, taskId);
        if (!task) {
          res.status(404).json({ error: "Tarefa Manus não encontrada" });
          return;
        }
        res.status(200).json({ task });
        return;
      }
      res.status(200).json({ tasks: await listXavierManusTasks(user.id) });
      return;
    }

    const body = bodyOf(req);
    const taskId = typeof body.task_id === "string" ? body.task_id : "";
    const message = typeof body.message === "string" ? body.message : "";
    if (!taskId.trim() || !message.trim()) {
      res.status(400).json({ error: "task_id e message são obrigatórios" });
      return;
    }
    const task = await getXavierManusTask(user.id, taskId);
    if (!task) {
      res.status(404).json({ error: "Tarefa Manus não encontrada" });
      return;
    }
    await sendManusTaskMessage(task.manus_task_id, message);
    res.status(202).json({ ok: true, task_id: task.id, manus_task_id: task.manus_task_id });
  } catch (error) {
    const authError = authErrorResponse(error);
    res.status(authError?.status || 502).json({
      error: authError?.message || (error as Error).message || "Não foi possível acessar as tarefas Manus",
    });
  }
}
